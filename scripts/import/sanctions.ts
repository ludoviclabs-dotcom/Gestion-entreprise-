import { Readable } from "node:stream";
import { parse as parseCsv } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type { Sql } from "postgres";
import {
  SANCTION_IMPORT_SOURCES,
  personKeys,
  sanctionKeys,
  sanctionsProjectionVersion,
  type SanctionEntryKind,
  type SanctionListKey,
  type SanctionRow,
} from "../../src/lib/connectors/sanctions-lists";
import { downloadWithRedirects, Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

/**
 * Import des listes de sanctions et de contrôle INTERNATIONALES (hors UE) :
 * États-Unis (liste consolidée CSL), Royaume-Uni, ONU, Suisse, Canada.
 *
 * Une transaction par liste (indépendantes : une panne n'invalide pas les autres).
 * Projection stricte : organisations seulement — jamais de personne physique, de
 * navire ni d'aéronef — et aucune adresse, identifiant personnel, date de naissance
 * ni commentaire libre.
 */
export const SANCTION_URLS: Record<SanctionListKey, string> = {
  us: "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv",
  uk: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml",
  un: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
  ch: "https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?lang=en&action=downloadXmlGesamtlisteAction",
  ca: "https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml",
};
const HEADERS = { "User-Agent": "KYB-Graph/1.0 (veille conformité)", Accept: "*/*" };
/**
 * Hôtes vers lesquels une redirection est tolérée, par liste. L'ONU sert son fichier
 * par une redirection vers un stockage objet à jeton temporaire ; toute autre
 * redirection est refusée.
 */
export const SANCTION_REDIRECT_HOSTS: Record<SanctionListKey, readonly string[]> = {
  us: [],
  uk: [],
  un: ["unsolprodfiles.blob.core.windows.net"],
  ch: [],
  ca: [],
};

/** Personnes physiques importées seulement quand le drapeau est posé (migration appliquée). */
export const personsImportEnabled = (): boolean =>
  process.env.SANCTIONS_PERSONS_IMPORT_ENABLED === "true";

export type SanctionsStats = {
  received: number;
  kept: number;
  /** Personnes physiques conservées (drapeau posé). */
  persons: number;
  /** Personnes physiques non conservées (drapeau éteint). */
  individuals: number;
  vessels: number;
  delisted: number;
  nonLatin: number;
};
const newStats = (): SanctionsStats => ({ received: 0, kept: 0, persons: 0, individuals: 0, vessels: 0, delisted: 0, nonLatin: 0 });
export type Parsed = { rows: SanctionRow[]; stats: SanctionsStats };

// ── Utilitaires ────────────────────────────────────────────────────────────
const MAX_NAME = 300;
const MAX_ALIASES = 40;
const MAX_LABELS = 6;
const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
type Node = Record<string, unknown>;
const isNode = (v: unknown): v is Node => !!v && typeof v === "object" && !Array.isArray(v);
/** Éléments objets d'une valeur (un élément seul ou une liste). */
const nodes = (v: unknown): Node[] => asArray<unknown>(v as unknown).filter(isNode);
/** Propriété d'un nœud, ou `undefined` si la valeur n'est pas un objet. */
const child = (v: unknown, key: string): unknown => (isNode(v) ? v[key] : undefined);
const unique = (values: string[], max: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.replace(/\s+/g, " ").trim();
    const k = v.toLowerCase();
    if (!v || v.length > MAX_NAME || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
};
/** Années plausibles (1880–2015) trouvées dans des libellés de dates de naissance. */
export function birthYearsIn(texts: readonly string[]): number[] {
  const years = new Set<number>();
  for (const text of texts) {
    for (const m of text.matchAll(/(?<!\d)(18[89]\d|19\d{2}|200\d|201[0-5])(?!\d)/g)) {
      years.add(Number(m[1]));
      if (years.size >= 8) return [...years].sort();
    }
  }
  return [...years].sort();
}
/** Date tolérante : toute valeur illisible devient `null` (information, pas clé). */
function isoDate(value: string, order: "ymd" | "dmy"): string | null {
  const v = value.trim();
  const m = order === "dmy" ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v) : /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const [y, mo, d] = order === "dmy" ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
  const iso = `${y}-${mo}-${d}`;
  const t = Date.parse(iso);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso && y >= "1900" ? iso : null;
}

class RowBuilder {
  readonly rows: SanctionRow[] = [];
  private readonly seen = new Set<string>();
  constructor(private readonly list: SanctionListKey, private readonly stats: SanctionsStats) {}

  add(r: {
    key: string;
    sublist?: string | null;
    name: string;
    aliases?: string[];
    programs?: string[];
    countries?: string[];
    listedOn?: string | null;
    kind: SanctionEntryKind;
    birthYears?: number[];
  }): void {
    const name = r.name.replace(/\s+/g, " ").trim();
    if (!name || name.length > MAX_NAME || !r.key) return;
    const aliases = unique(r.aliases ?? [], MAX_ALIASES).filter((a) => a.toLowerCase() !== name.toLowerCase());
    const keys = r.kind === "person" ? personKeys([name, ...aliases]) : sanctionKeys([name, ...aliases]);
    // Une entrée sans aucun mot latin ne peut être rapprochée d'aucune dénomination.
    if (keys.length === 0) {
      this.stats.nonLatin++;
      return;
    }
    let entryKey = r.key;
    for (let n = 2; this.seen.has(entryKey); n++) entryKey = `${r.key}~${n}`;
    this.seen.add(entryKey);
    this.rows.push({
      list_key: this.list,
      entry_key: entryKey.slice(0, 200),
      sublist: r.sublist ?? null,
      name,
      aliases,
      keys,
      programs: unique(r.programs ?? [], MAX_LABELS),
      countries: unique(r.countries ?? [], MAX_LABELS),
      listed_on: r.listedOn ?? null,
      kind: r.kind,
      birth_years: r.kind === "person" ? (r.birthYears ?? []) : [],
    });
    this.stats.kept++;
    if (r.kind === "person") this.stats.persons++;
  }
}

const xml = (arrays: string[]) =>
  new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => arrays.includes(name),
  });

// ── États-Unis : liste consolidée (CSV) ───────────────────────────────────
const CSL_SUBLISTS: [RegExp, string][] = [
  [/^Specially Designated Nationals/i, "SDN — OFAC (Trésor)"],
  [/^Sectoral Sanctions/i, "SSI — OFAC (Trésor)"],
  [/^Non-SDN Chinese Military/i, "NS-CMIC — OFAC (Trésor)"],
  [/^Non-SDN Menu-Based/i, "NS-MBS — OFAC (Trésor)"],
  [/^Capta/i, "CAPTA — OFAC (Trésor)"],
  [/^Palestinian Legislative/i, "PLC — OFAC (Trésor)"],
  [/^Entity List/i, "Entity List — BIS (Commerce)"],
  [/^Denied Persons/i, "Denied Persons List — BIS (Commerce)"],
  [/^Unverified List/i, "Unverified List — BIS (Commerce)"],
  [/^Military End User/i, "Military End User List — BIS (Commerce)"],
  [/^ITAR Debarred/i, "ITAR Debarred — DDTC (État)"],
  [/^Nonproliferation Sanctions/i, "Nonproliferation Sanctions — État"],
];
const cslSublist = (source: string): string => {
  for (const [re, label] of CSL_SUBLISTS) if (re.test(source)) return label;
  return source.split(" - ")[0].slice(0, 80);
};
const REQUIRED_CSL = ["_id", "source", "type", "name", "programs", "addresses", "alt_names", "start_date"];

export function parseCsl(text: string): Parsed {
  const records = parseCsv(text, { columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }) as Record<string, string>[];
  if (records.length === 0 || REQUIRED_CSL.some((c) => !(c in records[0]))) throw new Error("SANCTIONS_US_SCHEMA");
  const stats = newStats();
  const b = new RowBuilder("us", stats);
  for (const r of records) {
    stats.received++;
    const type = asString(r.type);
    if (type === "Individual") {
      if (!personsImportEnabled()) { stats.individuals++; continue; }
      b.add({
        key: asString(r._id) || `${asString(r.source)}|${asString(r.name)}`,
        sublist: cslSublist(asString(r.source)),
        name: asString(r.name),
        aliases: asString(r.alt_names).split(";"),
        programs: asString(r.programs).split(";").map((p) => p.trim()),
        countries: [...asString(r.nationalities).split(";"), ...asString(r.citizenships).split(";")],
        listedOn: isoDate(asString(r.start_date), "ymd"),
        kind: "person",
        birthYears: birthYearsIn([asString(r.dates_of_birth)]),
      });
      continue;
    }
    if (type === "Vessel" || type === "Aircraft") { stats.vessels++; continue; }
    // Type vide (listes de contrôle des exportations) : conservé, jamais présumé personne.
    const kind: SanctionEntryKind = type === "Entity" ? "entity" : "unknown";
    const countries = [...asString(r.addresses).matchAll(/,\s*([A-Z]{2})\s*(?:;|$)/g)].map((m) => m[1]);
    b.add({
      key: asString(r._id) || `${asString(r.source)}|${asString(r.name)}`,
      sublist: cslSublist(asString(r.source)),
      name: asString(r.name),
      aliases: asString(r.alt_names).split(";"),
      programs: asString(r.programs).split(";").map((p) => p.trim()),
      countries,
      listedOn: isoDate(asString(r.start_date), "ymd"),
      kind,
    });
  }
  return { rows: b.rows, stats };
}

// ── Royaume-Uni (XML) ─────────────────────────────────────────────────────
export function parseUk(text: string): Parsed {
  const raw = child(child(xml(["Designation", "Name", "Address"]).parse(text), "Designations"), "Designation");
  if (!Array.isArray(raw)) throw new Error("SANCTIONS_UK_SCHEMA");
  const designations = nodes(raw);
  const stats = newStats();
  const b = new RowBuilder("uk", stats);
  for (const d of designations) {
    stats.received++;
    const nature = asString(d.IndividualEntityShip);
    if (nature === "Individual") {
      if (!personsImportEnabled()) { stats.individuals++; continue; }
      const names = nodes(child(d.Names, "Name")).map((n) => ({
        type: asString(n.NameType).toLowerCase(),
        text: [n.Name1, n.Name2, n.Name3, n.Name4, n.Name5, n.Name6].map((p) => asString(p)).filter(Boolean).join(" "),
      })).filter((n) => n.text);
      const main = names.find((n) => n.type === "primary name") ?? names[0];
      if (!main) continue;
      const details = nodes(child(d.IndividualDetails, "Individual"));
      b.add({
        key: asString(d.UniqueID) || asString(d.OFSIGroupID),
        sublist: null,
        name: main.text,
        aliases: names.filter((n) => n !== main).map((n) => n.text),
        programs: [asString(d.RegimeName)],
        countries: details.flatMap((i) => asArray<unknown>(child(i.Nationalities, "Nationality") as unknown).map((v) => asString(v))),
        listedOn: isoDate(asString(d.DateDesignated), "dmy"),
        kind: "person",
        birthYears: birthYearsIn(details.flatMap((i) => asArray<unknown>(child(i.DOBs, "DOB") as unknown).map((v) => asString(v)))),
      });
      continue;
    }
    if (nature === "Ship") { stats.vessels++; continue; }
    if (nature !== "Entity") continue;
    const names = nodes(child(d.Names, "Name")).map((n) => ({
      type: asString(n.NameType).toLowerCase(),
      text: asString(n.Name6) || [n.Name1, n.Name2, n.Name3, n.Name4, n.Name5].map((p) => asString(p)).filter(Boolean).join(" "),
    })).filter((n) => n.text);
    const main = names.find((n) => n.type === "primary name") ?? names[0];
    if (!main) continue;
    b.add({
      key: asString(d.UniqueID) || asString(d.OFSIGroupID),
      sublist: null,
      name: main.text,
      aliases: names.filter((n) => n !== main).map((n) => n.text),
      programs: [asString(d.RegimeName)],
      countries: nodes(child(d.Addresses, "Address")).map((a) => asString(a.AddressCountry)),
      listedOn: isoDate(asString(d.DateDesignated), "dmy"),
      kind: "entity",
    });
  }
  return { rows: b.rows, stats };
}

// ── ONU : liste consolidée (XML) ──────────────────────────────────────────
export function parseUn(text: string): Parsed {
  const list = child(xml(["ENTITY", "ENTITY_ALIAS", "ENTITY_ADDRESS", "INDIVIDUAL"]).parse(text), "CONSOLIDATED_LIST");
  if (!isNode(list) || !("ENTITIES" in list)) throw new Error("SANCTIONS_UN_SCHEMA");
  const entities = nodes(child(list.ENTITIES, "ENTITY"));
  const stats = newStats();
  const individuals = nodes(child(list.INDIVIDUALS, "INDIVIDUAL"));
  stats.individuals = personsImportEnabled() ? 0 : individuals.length;
  const b = new RowBuilder("un", stats);
  if (personsImportEnabled()) {
    for (const p of individuals) {
      stats.received++;
      const given = [p.FIRST_NAME, p.SECOND_NAME, p.THIRD_NAME, p.FOURTH_NAME].map((x) => asString(x)).filter(Boolean).join(" ");
      const dates = nodes(p.INDIVIDUAL_DATE_OF_BIRTH).flatMap((d) =>
        [d.YEAR, d.FROM_YEAR, d.TO_YEAR, d.DATE].map((x) => asString(x)),
      );
      b.add({
        key: asString(p.REFERENCE_NUMBER) || asString(p.DATAID),
        name: given,
        aliases: nodes(p.INDIVIDUAL_ALIAS).map((a) => asString(a.ALIAS_NAME)),
        programs: [`ONU — ${asString(p.UN_LIST_TYPE)}`],
        countries: asArray<unknown>(child(p.NATIONALITY, "VALUE") as unknown).map((v) => asString(v)),
        listedOn: isoDate(asString(p.LISTED_ON), "ymd"),
        kind: "person",
        birthYears: birthYearsIn(dates),
      });
    }
  }
  for (const e of entities) {
    stats.received++;
    b.add({
      key: asString(e.REFERENCE_NUMBER) || asString(e.DATAID),
      name: asString(e.FIRST_NAME),
      aliases: nodes(e.ENTITY_ALIAS).map((a) => asString(a.ALIAS_NAME)),
      programs: [`ONU — ${asString(e.UN_LIST_TYPE)}`],
      countries: nodes(e.ENTITY_ADDRESS).map((a) => asString(a.COUNTRY)),
      listedOn: isoDate(asString(e.LISTED_ON), "ymd"),
      kind: "entity",
    });
  }
  return { rows: b.rows, stats };
}

// ── Suisse (SECO, XML) ────────────────────────────────────────────────────
export function parseCh(text: string): Parsed {
  const root = child(
    xml([
      "target", "sanctions-program", "sanctions-set", "program-key", "modification", "identity", "name",
      "name-part", "value", "spelling-variant", "entity", "individual", "object",
    ]).parse(text),
    "swiss-sanctions-list",
  );
  const rawTargets = child(root, "target");
  if (!Array.isArray(rawTargets)) throw new Error("SANCTIONS_CH_SCHEMA");
  const targets = nodes(rawTargets);

  // Jeu de sanctions → programme (libellé anglais).
  const programOf = new Map<string, string>();
  for (const program of nodes(child(root, "sanctions-program"))) {
    const keyEng = nodes(program["program-key"]).find((k) => asString(k["@_lang"]) === "eng");
    const label = asString(keyEng?.["#text"]);
    for (const set of nodes(program["sanctions-set"])) {
      const id = asString(set["@_ssid"]);
      if (id && label) programOf.set(id, label);
    }
  }

  const stats = newStats();
  const b = new RowBuilder("ch", stats);
  for (const t of targets) {
    stats.received++;
    const wantPerson = Boolean(t.individual) && personsImportEnabled();
    if (!t.entity && !wantPerson) {
      if (t.individual) stats.individuals++;
      else stats.vessels++;
      continue;
    }
    // Le fichier « liste complète » contient aussi l'HISTORIQUE : la dernière
    // modification (la plus récente est en tête) décide si l'entrée est en vigueur.
    const mods = nodes(t.modification);
    if (mods.length > 0 && asString(mods[0]["@_modification-type"]) === "de-listed") {
      stats.delisted++;
      continue;
    }
    const entity = nodes(t.entity)[0] ?? nodes(t.individual)[0] ?? {};
    const isPerson = !t.entity;
    const names: { type: string; main: boolean; texts: string[] }[] = [];
    for (const identity of nodes(entity.identity)) {
      for (const n of nodes(identity.name)) {
        const parts = nodes(n["name-part"])
          .sort((x, y) => Number(x["@_order"] ?? 0) - Number(y["@_order"] ?? 0));
        const whole = parts.map((p) => asString(asArray<unknown>(p.value as unknown)[0])).filter(Boolean).join(" ");
        // Variantes d'écriture en alphabet latin (le nom principal peut être cyrillique).
        const latin = parts.flatMap((p) => nodes(p["spelling-variant"]))
          .filter((v) => asString(v["@_script"]) === "LATN").map((v) => asString(v["#text"]));
        names.push({ type: asString(n["@_name-type"]), main: asString(identity["@_main"]) === "true", texts: [whole, ...latin].filter(Boolean) });
      }
    }
    const primary = names.find((n) => n.type === "primary-name" && n.main) ?? names.find((n) => n.type === "primary-name") ?? names[0];
    if (!primary || primary.texts.length === 0) continue;
    // Le nom principal peut être non latin : une variante latine prend alors le relais.
    const latinFirst = primary.texts.find((x) => sanctionKeys([x]).length > 0) ?? primary.texts[0];
    const aliases = [
      ...primary.texts.filter((x) => x !== latinFirst),
      ...names.filter((n) => n !== primary).flatMap((n) => n.texts),
    ];
    const listed = mods.filter((m) => asString(m["@_modification-type"]) === "listed")
      .map((m) => asString(m["@_enactment-date"]) || asString(m["@_effective-date"])).filter(Boolean).sort()[0];
    const setId = asString(t["sanctions-set-id"]);
    b.add({
      key: asString(t["@_ssid"]) || `${setId}|${latinFirst}`,
      name: latinFirst,
      aliases,
      programs: [programOf.get(setId) ?? ""].filter(Boolean).map((p) => `Suisse — ${p}`),
      countries: [],
      listedOn: listed ? isoDate(listed, "ymd") : null,
      kind: isPerson ? "person" : "entity",
      birthYears: isPerson
        ? birthYearsIn(nodes(entity.identity).flatMap((i) => nodes(i["day-month-year"]).map((d) => asString(d["@_year"]))))
        : undefined,
    });
  }
  return { rows: b.rows, stats };
}

// ── Canada (mesures spéciales, XML) ───────────────────────────────────────
export function parseCa(text: string): Parsed {
  const rawRecords = child(child(xml(["record"]).parse(text), "data-set"), "record");
  if (!Array.isArray(rawRecords)) throw new Error("SANCTIONS_CA_SCHEMA");
  const records = nodes(rawRecords);
  const stats = newStats();
  const b = new RowBuilder("ca", stats);
  for (const r of records) {
    stats.received++;
    const name = asString(r["EntityOrShip-EntiteOuNavire"]);
    if (!name) {
      // Fiche de personne (nom de famille + prénom) : conservée seulement si le
      // drapeau d'import des personnes est posé.
      const person = [r["GivenName-Prenom"], r["LastName-NomDeFamille"]].map((x) => asString(x)).filter(Boolean).join(" ");
      if (!personsImportEnabled() || !person) { stats.individuals++; continue; }
      const country = asString(r["Country-Pays"]).split("/")[0].trim();
      b.add({
        key: `${asString(r["Schedule-Annexe"])}|${asString(r["Item-NumeroDarticle"])}|${country}`,
        name: person,
        aliases: asString(r["Aliases-Alias"]).split(/[/;]/),
        programs: [country ? `Canada — ${country}` : "Canada"],
        countries: [country],
        listedOn: isoDate(asString(r["DateOfListing-DateDinscription"]), "ymd"),
        kind: "person",
        birthYears: birthYearsIn([asString(r["DateOfBirthOrShipBuildDate-DateDeNaissanceOuDateDeConstructionDuNavire"])]),
      });
      continue;
    }
    // Navire : numéro OMI ou type de navire renseigné.
    if (asString(r["ShipIMONumber-NumeroOMIDuNavire"]) || asString(r["TitleOrShipType-TitreOuTypeDeNavire"])) {
      stats.vessels++;
      continue;
    }
    const country = asString(r["Country-Pays"]).split("/")[0].trim();
    const schedule = asString(r["Schedule-Annexe"]);
    b.add({
      key: `${schedule}|${asString(r["Item-NumeroDarticle"])}|${country}`,
      name,
      aliases: asString(r["Aliases-Alias"]).split(/[/;]/),
      programs: [country ? `Canada — ${country}` : "Canada"],
      countries: [country],
      listedOn: isoDate(asString(r["DateOfListing-DateDinscription"]), "ymd"),
      kind: "entity",
    });
  }
  return { rows: b.rows, stats };
}

// ── Lecture bornée, empreinte, lignes ─────────────────────────────────────
type ListConfig = { parse: (text: string) => Parsed; maxBytes: number; minimum: number };
const MIB = 1024 * 1024;
export const SANCTION_CONFIG: Record<SanctionListKey, ListConfig> = {
  us: { parse: parseCsl, maxBytes: 64 * MIB, minimum: 5000 },
  uk: { parse: parseUk, maxBytes: 96 * MIB, minimum: 500 },
  un: { parse: parseUn, maxBytes: 16 * MIB, minimum: 100 },
  ch: { parse: parseCh, maxBytes: 128 * MIB, minimum: 1000 },
  ca: { parse: parseCa, maxBytes: 32 * MIB, minimum: 500 },
};

/**
 * Le fichier est lu en entier (≤ 128 Mio selon la liste), validé, projeté, puis
 * seulement alors publié : un fichier tronqué, d'un autre format ou vide est refusé
 * et la version précédente reste servie.
 */
export function sanctionsInput(
  list: SanctionListKey,
  source: Readable,
  options: { minimum?: number } = {},
): ImportInput<SanctionRow> & { stats: SanctionsStats } {
  const cfg = SANCTION_CONFIG[list];
  const minimum = options.minimum ?? cfg.minimum;
  const fp = new Fingerprint(cfg.maxBytes);
  const stats = newStats();
  let complete = false;
  async function* rows(): AsyncGenerator<SanctionRow> {
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of fp.measure(source)) chunks.push(Buffer.from(chunk));
    } finally { source.destroy(); }
    const text = Buffer.concat(chunks).toString("utf8").replace(/^﻿/, "");
    chunks.length = 0;
    const parsed = cfg.parse(text);
    Object.assign(stats, parsed.stats);
    if (parsed.rows.length < minimum) throw new Error(`SANCTIONS_${list.toUpperCase()}_INCOMPLETE_SOURCE`);
    yield* parsed.rows;
    complete = true;
  }
  return { rows: rows(), stats, fingerprint: () => {
    if (!complete) throw new Error(`SANCTIONS_${list.toUpperCase()}_INCOMPLETE_SOURCE`);
    return fp.finish();
  } };
}

export const sanctionsWriter = (list: SanctionListKey): DatasetWriter<SanctionRow> => ({
  async write(tx, importId, rows) {
    const base = rows.map((r) => ({
      import_id: importId,
      list_key: r.list_key,
      entry_key: r.entry_key,
      sublist: r.sublist,
      name: r.name,
      // Tableaux, jamais des chaînes : le client sérialise lui-même le type jsonb.
      aliases: r.aliases,
      keys: r.keys,
      programs: r.programs,
      countries: r.countries,
      listed_on: r.listed_on,
      kind: r.kind,
    }));
    if (personsImportEnabled()) {
      // Colonne `birth_years` (migration 0020) : écrite seulement quand les
      // personnes sont importées, pour ne pas dépendre de la migration sinon.
      await tx`insert into sanctions_entries ${tx(base.map((r, i) => ({ ...r, birth_years: rows[i].birth_years })))}
        on conflict (import_id, entry_key) do update set sublist = excluded.sublist, name = excluded.name,
          aliases = excluded.aliases, keys = excluded.keys, programs = excluded.programs,
          countries = excluded.countries, listed_on = excluded.listed_on, kind = excluded.kind,
          birth_years = excluded.birth_years`;
    } else {
      await tx`insert into sanctions_entries ${tx(base)}
        on conflict (import_id, entry_key) do update set sublist = excluded.sublist, name = excluded.name,
          aliases = excluded.aliases, keys = excluded.keys, programs = excluded.programs,
          countries = excluded.countries, listed_on = excluded.listed_on, kind = excluded.kind`;
    }
  },
  async count(tx, id) {
    const rows = await tx`select count(*)::int as count from sanctions_entries where import_id = ${id}`;
    return Number(rows[0].count);
  },
  // Table partagée par les cinq listes : la purge est bornée à la liste importée.
  async prune(tx, id) {
    await tx`delete from sanctions_entries where list_key = ${list} and import_id <> ${id}`;
  },
});

export async function importSanctionsList(db: Sql, list: SanctionListKey) {
  let input: ReturnType<typeof sanctionsInput> | null = null;
  const url = SANCTION_URLS[list];
  const report = await runImport(
    { source: SANCTION_IMPORT_SOURCES[list], version: sanctionsProjectionVersion(personsImportEnabled()), sourceUrl: url },
    async () => {
      input = sanctionsInput(
        list,
        await downloadWithRedirects(url, AbortSignal.timeout(10 * 60 * 1000), HEADERS, SANCTION_REDIRECT_HOSTS[list]),
      );
      return input;
    },
    postgresImportStore(db, sanctionsWriter(list)),
  );
  return { ...report, stats: (input as ReturnType<typeof sanctionsInput> | null)?.stats };
}
