import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parser } from "stream-json";
import { filter } from "stream-json/filters/Filter";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";
import type { Sql } from "postgres";
import { isValidSiren } from "../../src/lib/siren";
import { download, Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

export const DECP_CATALOG = "https://www.data.gouv.fr/api/1/datasets/donnees-essentielles-de-la-commande-publique-fichiers-consolides/";
export type DecpWindow = { start: string; end: string };
export type DecpResource = { month: string; url: string };
export type DecpRow = {
  acheteur_id: string; marche_id: string; cpv: string; objet_hash: string; titulaire_id: string;
  titulaire_siren: string; titulaire_id_type: "SIRET"; acheteur_siren: string | null;
  holder_count: number; nature: string | null; procedure: string | null;
  notified_on: string; published_on: string | null; amount: number | null; amount_unreliable: boolean;
  source: string | null; file_month: string;
};
export type DecpSummaryRow = {
  siren: string; role: "holder" | "buyer"; total: number; reliable_amount: number; single_reliable: number;
  grouped: number; unreliable: number; last_notified: string;
  buyers: { id: string; count: number }[];
  items: { key: string; buyerId: string; marketId: string; objectHash: string; holderId: string; cpv: string;
    notifiedOn: string; holderCount: number; amount: number | null; amountUnreliable: boolean;
    nature: string | null; procedure: string | null; source: string | null }[];
};
export type DecpFileStats = { month: string; read: number; inWindow: number; outsideWindow: number;
  invalidNotificationDate: number; attributions: number; nonSiret: number; invalidSiren: number;
  invalidBuyer: number; invalidIdentity: number; modifications: number; bytes: number; sha256: string; seconds: number };
export type DecpStats = { files: DecpFileStats[]; duplicates: number; retained: number; window: DecpWindow };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const decpDate = (v: unknown): string | null => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : null;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const sirenOf = (v: unknown): string | null => typeof v === "string" && /^\d{14}$/.test(v) && v.slice(0, 9) !== "000000000" && isValidSiren(v.slice(0, 9)) ? v.slice(0, 9) : null;

export function decpWindow(now = new Date()): DecpWindow {
  const end = now.toISOString().slice(0, 10), start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  // Le 29 février devient le dernier jour de février de l'année précédente.
  if (start.getUTCMonth() !== now.getUTCMonth()) start.setUTCDate(0);
  return { start: start.toISOString().slice(0, 10), end };
}

/** Catalogue institutionnel fermé : aucun texte libre de fournisseur n'est persisté. */
const NATURES = ["Marché", "Marché de partenariat", "Accord-cadre", "Marché subséquent"];
const PROCEDURES = ["Procédure adaptée", "Appel d'offres ouvert", "Appel d'offres restreint", "Procédure avec négociation", "Dialogue compétitif", "Marché passé sans publicité ni mise en concurrence préalable"];
const SOURCES = ["aife", "pes", "aws", "atexo", "dematis", "megalis", "ternum", "data.gouv.fr", "marches-publics.info", "marches-publics.gouv.fr"];
const closed = (v: unknown, list: string[]) => typeof v === "string" ? list.find(x => x.toLowerCase() === v.trim().toLowerCase()) ?? null : null;
export function normalizeCpv(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digits = v.trim().replace(/-\d$/, "");
  return /^\d{1,16}$/.test(digits) ? digits.padEnd(8, "0").slice(0, 8) : null;
}

/** Un marché × un SIRET titulaire. Les identifiants libres de marché sont opaques :
 * empreinte complète de l'id exact, pour préserver son identité sans stocker de texte
 * pouvant nommer une personne. L'objet est normalisé puis haché séparément (12 hex). */
export function projectDecp(value: unknown, fileMonth: string, window: DecpWindow, stats: DecpFileStats): DecpRow[] {
  const v = object(value);
  stats.read++;
  if (v.hasModifications === true || (Array.isArray(v.modifications) && v.modifications.length > 0)) stats.modifications++;
  if (!Array.isArray(v.titulaires)) throw new Error("DECP_MARKET_SCHEMA");
  const notified = decpDate(v.dateNotification);
  if (!notified || notified < "2015-01-01" || notified > window.end) { stats.invalidNotificationDate++; return []; }
  if (notified < window.start) { stats.outsideWindow++; return []; }
  stats.inWindow++;
  const buyer = object(v.acheteur).id, cpv = normalizeCpv(v.codeCPV);
  if (typeof buyer !== "string" || !/^\d{14}$/.test(buyer) || typeof v.id !== "string" || !v.id.trim() ||
    v.id.length > 256 || typeof v.objet !== "string" || !v.objet.trim() || !cpv) { stats.invalidIdentity++; return []; }
  const buyerSiren = sirenOf(buyer);
  if (!buyerSiren) stats.invalidBuyer++;
  const objetHash = hash(v.objet.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()).slice(0, 12);
  const amount = typeof v.montant === "number" && Number.isFinite(v.montant) ? v.montant : null;
  const rows: DecpRow[] = [];
  for (const wrapper of v.titulaires) {
    const t = object(object(wrapper).titulaire);
    if (typeof t.typeIdentifiant !== "string" || !("id" in t)) throw new Error("DECP_HOLDER_SCHEMA");
    if (t.typeIdentifiant !== "SIRET") { stats.nonSiret++; continue; }
    const siren = sirenOf(t.id);
    if (!siren) { stats.invalidSiren++; continue; }
    stats.attributions++;
    rows.push({ acheteur_id: buyer, marche_id: hash(v.id), cpv, objet_hash: objetHash, titulaire_id: t.id as string,
      titulaire_siren: siren, titulaire_id_type: "SIRET", acheteur_siren: buyerSiren, holder_count: v.titulaires.length,
      nature: closed(v.nature, NATURES), procedure: closed(v.procedure, PROCEDURES), notified_on: notified,
      published_on: decpDate(v.datePublicationDonnees), amount, amount_unreliable: amount === null || amount <= 0 || amount >= 999999999,
      source: closed(v.source, SOURCES), file_month: fileMonth });
  }
  return rows;
}
export const decpKey = (r: DecpRow) => [r.acheteur_id, r.marche_id, r.cpv, r.objet_hash, r.titulaire_id].join(":");
const rank = (r: DecpRow) => `${r.published_on ?? `${r.file_month}-01`}:${r.file_month}`;
/** Addition décimale des montants déclarés : pas d'arrondi au centime ni de
 * bruit binaire (0.1 + 0.2), y compris pour les montants inférieurs au centime. */
function sumDeclaredAmounts(amounts: number[]): number {
  let units = BigInt(0), scale = 0;
  const base = BigInt(10);
  for (const amount of amounts) {
    const [mantissa, exponent = "0"] = String(amount).split("e");
    const [integer, fraction = ""] = mantissa.split(".");
    let next = BigInt(integer + fraction), nextScale = fraction.length - Number(exponent);
    if (nextScale < 0) { next *= base ** BigInt(-nextScale); nextScale = 0; }
    if (nextScale > scale) { units *= base ** BigInt(nextScale - scale); scale = nextScale; }
    units += next * base ** BigInt(scale - nextScale);
  }
  return Number(`${units}e-${scale}`);
}
const emptyStats = (month: string): DecpFileStats => ({ month, read: 0, inWindow: 0, outsideWindow: 0,
  invalidNotificationDate: 0, attributions: 0, nonSiret: 0, invalidSiren: 0, invalidBuyer: 0, invalidIdentity: 0,
  modifications: 0, bytes: 0, sha256: "", seconds: 0 });

/** Accepte uniquement les URL mensuelles fournies par le catalogue officiel. */
export function decpResources(raw: unknown, window: DecpWindow): DecpResource[] {
  const resources = object(raw).resources;
  if (!Array.isArray(resources)) throw new Error("DECP_CATALOG_SCHEMA");
  const selected = new Map<string, DecpResource>();
  for (const item of resources) {
    const r = object(item), m = typeof r.title === "string" && /^decp-(\d{4}-(?:0[1-9]|1[0-2]))\.json$/.exec(r.title);
    if (!m || m[1] < window.start.slice(0, 7) || m[1] > window.end.slice(0, 7)) continue;
    if (typeof r.url !== "string") throw new Error("DECP_RESOURCE_URL");
    const url = new URL(r.url);
    if (url.protocol !== "https:" || url.hostname !== "static.data.gouv.fr" || url.username || url.password || url.search || url.hash ||
      !url.pathname.startsWith("/resources/donnees-essentielles-de-la-commande-publique-fichiers-consolides/") ||
      !url.pathname.endsWith(`/decp-${m[1]}.json`) || selected.has(m[1])) throw new Error("DECP_RESOURCE_URL");
    selected.set(m[1], { month: m[1], url: r.url });
  }
  const files = [...selected.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (!files.length || files.length > 13 || files[0].month !== window.start.slice(0, 7)) throw new Error("DECP_MISSING_MONTH");
  for (let i = 1; i < files.length; i++) {
    const next = new Date(`${files[i - 1].month}-01`); next.setUTCMonth(next.getUTCMonth() + 1);
    if (next.toISOString().slice(0, 7) !== files[i].month) throw new Error("DECP_MISSING_MONTH");
  }
  return files;
}

type Token = { name: string; value?: string };
const SELECTED = /^marches\.marche\.\d+\.(?:id|objet|codeCPV|nature|procedure|dateNotification|datePublicationDonnees|montant|source|acheteur\.id|titulaires\.\d+\.titulaire\.(?:id|typeIdentifiant))$/;
function packKeys() {
  let key: string | null = null;
  return new Transform({ objectMode: true, transform(t: Token, _e, done) {
    if (t.name === "startKey") key = "";
    else if (t.name === "stringChunk" && key !== null) { key += t.value ?? ""; if (key.length > 256) return done(new Error("DECP_KEY_LIMIT")); }
    else if (t.name === "endKey") { this.push({ name: "keyValue", value: key }); key = null; }
    else this.push(t); done();
  } });
}
function packValues() {
  let scalar = "", kind = "";
  return new Transform({ objectMode: true, transform(t: Token, _e, done) {
    if (t.name === "startString" || t.name === "startNumber") { scalar = ""; kind = t.name === "startString" ? "stringValue" : "numberValue"; }
    else if (t.name === "stringChunk" || t.name === "numberChunk") { scalar += t.value ?? ""; if (scalar.length > 32768) return done(new Error("DECP_SCALAR_LIMIT")); }
    else if (t.name === "endString" || t.name === "endNumber") { this.push({ name: kind, value: scalar }); scalar = ""; }
    else this.push(t); done();
  } });
}

export function decpInput(files: DecpResource[], open: (file: DecpResource) => Promise<Readable>, window: DecpWindow,
  limits = { minimum: 100, maxFileBytes: 256 * 1024 * 1024, maxTotalBytes: 2 * 1024 ** 3, maxRows: 1000000 }): ImportInput<DecpRow> & { stats: DecpStats } {
  const stats: DecpStats = { files: [], duplicates: 0, retained: 0, window };
  const fingerprint = createHash("sha256");
  let complete = false;
  async function* rows() {
    const unique = new Map<string, DecpRow>(); let totalBytes = 0;
    if (!files.length || files.length > 13) throw new Error("DECP_FILE_LIMIT");
    for (const file of files) {
      const start = Date.now(), s = emptyStats(file.month), fp = new Fingerprint(limits.maxFileBytes);
      const source = await open(file);
      async function* bytes() { for await (const chunk of source) yield typeof chunk === "string" ? Buffer.from(chunk) : chunk as Uint8Array; }
      const measured = Readable.from(fp.measure(bytes())), tokenizer = parser({ packStrings: false, packNumbers: false, packKeys: false });
      const keys = packKeys(); let found = false, tokens = 0, modifications = false;
      const whitelist = filter({ filter: (stack, token) => {
        const fail = () => { whitelist.destroy(new Error("DECP_STREAM_LIMIT")); return false; };
        if (stack.length > 64) return fail();
        if (stack.length === 2 && stack[0] === "marches" && stack[1] === "marche") {
          if (found || token.name !== "startArray") return fail(); found = true; return true;
        }
        if (stack.length === 3 && stack[0] === "marches" && stack[1] === "marche" && typeof stack[2] === "number") {
          if (token.name !== "startObject") return fail(); tokens = 0; modifications = false; return true;
        }
        if (stack.length === 5 && stack[3] === "modifications" && typeof stack[4] === "number" && !modifications) {
          modifications = true; s.modifications++;
        }
        const selected = SELECTED.test(stack.join("."));
        if (selected && ++tokens > 30000) return fail(); return selected;
      } });
      const values = packValues(), selected = pick({ filter: "marches.marche" }), output = streamArray({ highWaterMark: 1 });
      const pumped = pipeline(measured, tokenizer, keys, whitelist, values, selected, output).then(() => null, () => new Error("DECP_INVALID_STREAM"));
      try {
        for await (const { value } of output) {
          if (s.read >= 1000000) throw new Error("DECP_MARKET_LIMIT");
          for (const row of projectDecp(value, file.month, window, s)) {
            const key = decpKey(row), previous = unique.get(key);
            if (previous) stats.duplicates++;
            if (!previous || rank(row) > rank(previous)) unique.set(key, row);
            if (unique.size > limits.maxRows) throw new Error("DECP_ROW_LIMIT");
          }
        }
        if (await pumped || !found || s.read < limits.minimum) throw new Error("DECP_INCOMPLETE_FILE");
        s.bytes = fp.bytes; totalBytes += s.bytes;
        if (totalBytes > limits.maxTotalBytes) throw new Error("DECP_TOTAL_BYTE_LIMIT");
        s.sha256 = fp.finish(); s.seconds = (Date.now() - start) / 1000;
        fingerprint.update(`${file.month}:${s.sha256}\n`); stats.files.push(s);
      } finally {
        for (const stream of [source, measured, tokenizer, keys, whitelist, values, selected, output]) stream.destroy();
        await pumped;
      }
    }
    stats.retained = unique.size;
    if (unique.size < limits.minimum) throw new Error("DECP_INCOMPLETE_WINDOW");
    for (const row of unique.values()) yield row;
    complete = true;
  }
  return { rows: rows(), stats, fingerprint: () => { if (!complete) throw new Error("DECP_INCOMPLETE_SOURCE"); return fingerprint.digest("hex"); } };
}

/** Plan B : tous les totaux sont calculés AVANT le plafond de 20 événements.
 * Le même SIREN co-titulaire par deux NIC n'est compté qu'une fois par marché. */
export async function* decpSummaries(rows: AsyncIterable<DecpRow>): AsyncGenerator<DecpSummaryRow> {
  const groups = new Map<string, { siren: string; role: "holder" | "buyer"; markets: Map<string, DecpRow> }>();
  for await (const r of rows) {
    const identity = [r.acheteur_id, r.marche_id, r.cpv, r.objet_hash].join(":");
    for (const [role, siren] of [["holder", r.titulaire_siren], ["buyer", r.acheteur_siren]] as const) {
      if (!siren) continue;
      const key = `${role}:${siren}`;
      let group = groups.get(key);
      if (!group) { group = { siren, role, markets: new Map() }; groups.set(key, group); }
      const previous = group.markets.get(identity);
      if (!previous || rank(r) > rank(previous) || rank(r) === rank(previous) && r.titulaire_id < previous.titulaire_id) group.markets.set(identity, r);
    }
  }
  for (const [key, group] of groups) {
    const markets = [...group.markets.values()].sort((a, b) => b.notified_on.localeCompare(a.notified_on) ||
      a.acheteur_id.localeCompare(b.acheteur_id) || a.marche_id.localeCompare(b.marche_id) || a.cpv.localeCompare(b.cpv) || a.objet_hash.localeCompare(b.objet_hash));
    const buyers = new Map<string, number>(), amounts: number[] = []; let single = 0, grouped = 0, unreliable = 0;
    for (const r of markets) {
      buyers.set(r.acheteur_id, (buyers.get(r.acheteur_id) ?? 0) + 1);
      if (r.amount_unreliable) unreliable++;
      if (r.holder_count > 1) grouped++;
      else if (!r.amount_unreliable) { single++; amounts.push(r.amount!); }
    }
    const summary: DecpSummaryRow = { siren: group.siren, role: group.role, total: markets.length,
      reliable_amount: sumDeclaredAmounts(amounts), single_reliable: single, grouped, unreliable, last_notified: markets[0].notified_on,
      buyers: [...buyers].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)).slice(0, 5),
      items: markets.slice(0, 20).map(r => ({ key: createHash("md5").update([r.acheteur_id, r.marche_id, r.cpv, r.objet_hash].join(":")).digest("hex"),
        buyerId: r.acheteur_id, marketId: r.marche_id, objectHash: r.objet_hash, holderId: r.titulaire_id, cpv: r.cpv,
        notifiedOn: r.notified_on, holderCount: r.holder_count, amount: r.amount, amountUnreliable: r.amount_unreliable,
        nature: r.nature, procedure: r.procedure, source: r.source })) };
    group.markets.clear(); groups.delete(key);
    yield summary;
  }
}

export function decpWriter(window: DecpWindow, latestMonth: string): DatasetWriter<DecpSummaryRow> {
  return {
    async write(tx, id, rows) {
      await tx`insert into decp_windows (import_id, window_start, window_end, latest_file_month)
        values (${id}, ${window.start}, ${window.end}, ${latestMonth}) on conflict (import_id) do nothing`;
      // postgres sérialise les tableaux jsonb : aucune pré-sérialisation JSON.
      await tx`insert into decp_summaries ${tx(rows.map(r => ({ ...r, import_id: id })))}
        on conflict (import_id, siren, role) do update set total = excluded.total,
        reliable_amount = excluded.reliable_amount, single_reliable = excluded.single_reliable,
        grouped = excluded.grouped, unreliable = excluded.unreliable, last_notified = excluded.last_notified,
        buyers = excluded.buyers, items = excluded.items`;
    },
    async count(tx, id) { const r = await tx`select count(*)::int as count from decp_summaries where import_id = ${id}`; return Number(r[0].count); },
    async prune(tx, id) { await tx`delete from decp_summaries where import_id <> ${id}`; await tx`delete from decp_windows where import_id <> ${id}`; },
  };
}

export async function importDecp(db: Sql, now = new Date()) {
  const window = decpWindow(now);
  const deadline = AbortSignal.timeout(28 * 60 * 1000);
  let input: ReturnType<typeof decpInput> | undefined;
  let files: DecpResource[] = [];
  const writer: DatasetWriter<DecpSummaryRow> = {
    write: (tx, id, rows) => decpWriter(window, files.at(-1)!.month).write(tx, id, rows),
    count: (tx, id) => decpWriter(window, "").count(tx, id),
    prune: (tx, id) => decpWriter(window, "").prune(tx, id),
  };
  const identity = { source: "decp", version: `decp-v1-aggregate:${window.start}:${window.end}`, sourceUrl: DECP_CATALOG };
  const store = postgresImportStore(db, writer);
  let publishing = false;
  try {
    const catalog = await download(DECP_CATALOG, AbortSignal.timeout(60000)), fp = new Fingerprint(2 * 1024 * 1024), chunks = [];
    for await (const chunk of fp.measure(catalog)) chunks.push(chunk);
    files = decpResources(JSON.parse(Buffer.concat(chunks).toString("utf8")), window);
    input = decpInput(files, f => download(f.url, AbortSignal.any([deadline, AbortSignal.timeout(25 * 60 * 1000)])), window);
    // Préparer les seules synthèses minimisées avant le verrou SQL : pas de
    // transaction inactive pendant les treize téléchargements. La publication,
    // l'idempotence et la purge restent dans l'unique transaction du socle D0.
    const prepared: DecpSummaryRow[] = [];
    for await (const row of decpSummaries(input.rows)) prepared.push(row);
    const sha256 = input.fingerprint();
    publishing = true;
    const report = await runImport(identity, async () => ({ rows: (async function* () { yield* prepared; })(), fingerprint: () => sha256 }), store);
    return { ...report, stats: input.stats };
  } catch {
    // Une source en échec avant toute écriture doit aussi être observée comme
    // telle (et non « jamais importée »), sans conserver d'erreur amont privée.
    if (!publishing) await store.transaction(identity, async () => { throw new Error("DECP_SOURCE_FAILED"); }).catch(() => {});
    throw new Error("IMPORT_FAILED_PREVIOUS_DATA_PRESERVED");
  }
}
