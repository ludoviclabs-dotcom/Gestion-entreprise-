import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parser } from "stream-json";
import { filter } from "stream-json/filters/Filter";
import { pick } from "stream-json/filters/Pick";
import { streamArray } from "stream-json/streamers/StreamArray";
import type { Sql } from "postgres";
import { isValidSiren } from "../../src/lib/siren";
import { hatvpCategory } from "../../src/lib/ingestion/hatvp-categories";
import { download, Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

export const HATVP_URL = "https://www.hatvp.fr/agora/opendata/agora_repertoire_opendata.json";
export type HatvpRow = {
  siren: string; category_code: string | null; category_label: string | null; category_group: string | null;
  first_published_on: string | null; last_activity_published_on: string | null;
  activities_published: boolean | null; last_exercise_end: string | null; activity_count_last: number | null;
  no_activity_declared: boolean | null; ceased_on: string | null; deregistration_reason: "CESSATION" | "ABANDON" | null;
};
export type HatvpStats = { organisations: number; sirenRecords: number; unusableIdentifier: number; duplicates: number; unknownCategory: number };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const bool = (v: unknown): boolean | null => typeof v === "boolean" ? v : null;
const count = (v: unknown): number | null => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2147483647 ? v : null;

/** Dates officielles strictes ; l'heure sert seulement au choix du doublon. */
export function hatvpDate(v: unknown, exercise = false): string | null {
  if (v == null || v === "") return null;
  const m = typeof v === "string" && (exercise ? /^(\d{2})-(\d{2})-(\d{4})$/ : /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/).exec(v);
  if (!m) throw new Error("HATVP_INVALID_DATE");
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso ||
    (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59 || +m[6] > 59))) throw new Error("HATVP_INVALID_DATE");
  return iso;
}
const rankDate = (v: unknown) => { const d = hatvpDate(v); return d ? d + (String(v).slice(10) || " 00:00:00") : ""; };

/** Liste blanche : ni dénomination, nom d'usage, site, personne ou texte libre. */
export function projectHatvp(value: unknown): HatvpRow | null {
  const r = object(value), siren = r.identifiantNational;
  if (!r.typeIdentifiantNational || !("identifiantNational" in r)) throw new Error("HATVP_INVALID_ORGANISATION");
  if (r.typeIdentifiantNational !== "SIREN" || typeof siren !== "string" || !/^\d{9}$/.test(siren) || siren === "000000000" || !isValidSiren(siren)) return null;
  const category = hatvpCategory(object(r.categorieOrganisation).code);
  let lastEnd: string | null = null, last: Record<string, unknown> = {};
  if (r.exercices != null && !Array.isArray(r.exercices)) throw new Error("HATVP_INVALID_EXERCISES");
  for (const e of Array.isArray(r.exercices) ? r.exercices : []) {
    const p = object(object(e).publicationCourante), end = hatvpDate(p.dateFin, true);
    if (end && (!lastEnd || end > lastEnd)) { lastEnd = end; last = p; }
  }
  return { siren, category_code: category?.code ?? null, category_label: category?.label ?? null, category_group: category?.group ?? null,
    first_published_on: hatvpDate(r.datePremierePublication), last_activity_published_on: hatvpDate(r.dateDernierePublicationActivite),
    activities_published: bool(r.isActivitesPubliees), last_exercise_end: lastEnd, activity_count_last: count(last.nombreActivite),
    no_activity_declared: bool(last.noActivite), ceased_on: hatvpDate(r.dateCessation),
    deregistration_reason: r.motifDesinscription === "CESSATION" || r.motifDesinscription === "ABANDON" ? r.motifDesinscription : null };
}

const SELECTED = /^publications\.\d+\.(?:typeIdentifiantNational|identifiantNational|dateCreation|datePremierePublication|dateDernierePublicationActivite|dateCessation|motifDesinscription|isActivitesPubliees|categorieOrganisation\.code|exercices\.\d+\.publicationCourante\.(?:dateFin|nombreActivite|noActivite))$/;
type Token = { name: string; value?: string };

function packKeys() {
  let key: string | null = null;
  return new Transform({ objectMode: true, transform(t: Token, _encoding, done) {
    if (t.name === "startKey") key = "";
    else if (t.name === "stringChunk" && key !== null) {
      key += t.value ?? "";
      if (key.length > 256) return done(new Error("HATVP_KEY_TOO_LONG"));
    } else if (t.name === "endKey") { this.push({ name: "keyValue", value: key }); key = null; }
    else this.push(t);
    done();
  } });
}

/** Reconstitue seulement les scalaires autorisés, après filtrage des tokens.
 * Les chaînes privées ne sont jamais assemblées, même si elles sont très longues. */
function packSelected() {
  let scalar = "", kind = "";
  return new Transform({ objectMode: true, transform(t: Token, _encoding, done) {
    if (t.name === "startString" || t.name === "startNumber") { scalar = ""; kind = t.name === "startString" ? "stringValue" : "numberValue"; }
    else if (t.name === "stringChunk" || t.name === "numberChunk") {
      scalar += t.value ?? "";
      if (scalar.length > 256) return done(new Error("HATVP_SCALAR_TOO_LONG"));
    } else if (t.name === "endString" || t.name === "endNumber") { this.push({ name: kind, value: scalar }); scalar = ""; }
    else this.push(t);
    done();
  } });
}

export function hatvpInput(source: Readable, minimum = 1000, maxBytes = 256 * 1024 * 1024): ImportInput<HatvpRow> & { stats: HatvpStats } {
  const fp = new Fingerprint(maxBytes), stats: HatvpStats = { organisations: 0, sirenRecords: 0, unusableIdentifier: 0, duplicates: 0, unknownCategory: 0 };
  let complete = false;
  async function* rows(): AsyncGenerator<HatvpRow> {
    const measured = Readable.from(fp.measure(source));
    const tokenizer = parser({ packStrings: false, packNumbers: false, packKeys: false });
    const keys = packKeys();
    let publications = false, projectedTokens = 0;
    const whitelist = filter({ filter: (stack, token) => {
      const fail = () => { whitelist.destroy(new Error("HATVP_INVALID_STREAM")); return false; };
      if (stack.length > 64) return fail();
      if (stack.length === 1 && stack[0] === "publications") {
        if (publications || token.name !== "startArray") return fail();
        publications = true; return true;
      }
      if (stack.length === 2 && stack[0] === "publications" && typeof stack[1] === "number") {
        if (token.name !== "startObject") return fail();
        projectedTokens = 0; return true;
      }
      const selected = SELECTED.test(stack.join("."));
      if (selected && ++projectedTokens > 20000) return fail();
      return selected;
    } });
    const packer = packSelected(), selected = pick({ filter: "publications" }), output = streamArray({ highWaterMark: 1 });
    const pumped = pipeline(measured, tokenizer, keys, whitelist, packer, selected, output).then(() => null, () => new Error("HATVP_INVALID_STREAM"));
    // Seulement la projection minimisée ; nombre borné, jamais le JSON source.
    const unique = new Map<string, { rank: string; row: HatvpRow }>();
    try {
      for await (const { value } of output) {
        if (++stats.organisations > 100000) throw new Error("HATVP_TOO_MANY_ORGANISATIONS");
        const row = projectHatvp(value);
        if (!row) { stats.unusableIdentifier++; continue; }
        stats.sirenRecords++;
        if (!row.category_code) stats.unknownCategory++;
        const r = object(value), activityRank = rankDate(r.dateDernierePublicationActivite), creationRank = rankDate(r.dateCreation);
        const rank = activityRank || creationRank;
        const previous = unique.get(row.siren);
        if (previous) stats.duplicates++;
        if (!previous || rank > previous.rank) unique.set(row.siren, { rank, row });
      }
      if (await pumped || !publications || stats.organisations < minimum || unique.size < minimum) throw new Error("HATVP_INCOMPLETE_SOURCE");
      complete = true;
      for (const { row } of unique.values()) yield row;
    } finally {
      source.destroy(); measured.destroy(); tokenizer.destroy(); keys.destroy(); whitelist.destroy(); packer.destroy(); selected.destroy(); output.destroy();
      await pumped;
    }
  }
  let exhausted = false;
  async function* validatedRows() { yield* rows(); exhausted = true; }
  return { rows: validatedRows(), stats, fingerprint: () => {
    if (!complete || !exhausted) throw new Error("HATVP_INCOMPLETE_SOURCE");
    return fp.finish();
  } };
}

export const hatvpWriter: DatasetWriter<HatvpRow> = {
  async write(tx, id, rows) {
    const unique = new Map(rows.map(r => [r.siren, r]));
    await tx`insert into hatvp_organisations ${tx([...unique.values()].map(r => ({ ...r, import_id: id })))}
      on conflict (import_id, siren) do update set
        category_code = excluded.category_code, category_label = excluded.category_label, category_group = excluded.category_group,
        first_published_on = excluded.first_published_on, last_activity_published_on = excluded.last_activity_published_on,
        activities_published = excluded.activities_published, last_exercise_end = excluded.last_exercise_end,
        activity_count_last = excluded.activity_count_last, no_activity_declared = excluded.no_activity_declared,
        ceased_on = excluded.ceased_on, deregistration_reason = excluded.deregistration_reason`;
  },
  async count(tx, id) { const r = await tx`select count(*)::int as count from hatvp_organisations where import_id = ${id}`; return Number(r[0].count); },
  async prune(tx, id) { await tx`delete from hatvp_organisations where import_id <> ${id}`; },
};

export async function importHatvp(db: Sql) {
  let input: ReturnType<typeof hatvpInput> | undefined;
  const report = await runImport({ source: "hatvp", version: "hatvp-v1", sourceUrl: HATVP_URL },
    async () => { input = hatvpInput(await download(HATVP_URL, AbortSignal.timeout(25 * 60 * 1000))); return input; }, postgresImportStore(db, hatvpWriter));
  return { ...report, stats: input!.stats };
}
