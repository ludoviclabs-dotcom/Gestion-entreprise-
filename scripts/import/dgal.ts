import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import type { Sql } from "postgres";
import { isValidSiren } from "../../src/lib/siren";
import { DGAL_APPROVAL, DGAL_BASE, DGAL_CODES, DGAL_PAGE, DGAL_SECTIONS, dgalSection } from "../../src/lib/ingestion/dgal-reference";
import { Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

export type DgalRow = { siren: string; siret: string; approval: string; section: string;
  categories: string[]; associated: string[]; exported_on: string | null };
export type DgalFileStats = { section: string; url: string; read: number; usable: number; missingSiret: number;
  invalidSiren: number; invalidApproval: number; unknownCodes: number; bytes: number; sha256: string;
  exportedOn: string | null; seconds: number };
export type DgalStats = { files: DgalFileStats[]; duplicates: number; retained: number };
export type DgalDownload = { stream: Readable; exportedOn: string | null };
const HEADERS = { siret: "SIRET", approval: "Numéro agrément/Approval number", categories: "Catégorie/Category", associated: "Activités associées/Associated activities" };
const known = new Set<string>(DGAL_CODES);
export function projectDgal(row: Record<string, string>, section: string, exportedOn: string | null, stats: DgalFileStats): DgalRow | null {
  if (!dgalSection(section)) throw new Error("DGAL_SECTION");
  stats.read++;
  const siret = row[HEADERS.siret].trim();
  if (!siret) { stats.missingSiret++; return null; }
  const siren = siret.slice(0, 9);
  if (!/^\d{14}$/.test(siret) || siren === "000000000" || !isValidSiren(siren)) { stats.invalidSiren++; return null; }
  const approval = row[HEADERS.approval].trim();
  if (!DGAL_APPROVAL.test(approval)) { stats.invalidApproval++; return null; }
  const codes = (value: string, associated = false) => [...new Set(value.split(";").map(s => s.trim()).filter(Boolean).filter(s => {
    const m = associated ? /^(0|I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|RC)\(([A-Z]+)\)$/.exec(s) : null;
    const valid = associated ? !!m && known.has(m[2]) : known.has(s);
    if (!valid) stats.unknownCodes++; return valid;
  }))].sort();
  const categories = codes(row[HEADERS.categories]), associated = codes(row[HEADERS.associated], true);
  stats.usable++;
  return { siren, siret, approval, section, categories, associated, exported_on: exportedOn };
}

/** Hôtes/chemins fixés : aucune URL configurable ni redirection. */
export async function downloadDgal(section: typeof DGAL_SECTIONS[number], signal: AbortSignal): Promise<DgalDownload> {
  if (!DGAL_SECTIONS.includes(section)) throw new Error("DGAL_SECTION");
  const response = await fetch(DGAL_BASE + section.file, { signal, redirect: "error" });
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error("DGAL_HTTP"); }
  const lastModified = response.headers.get("last-modified"), date = lastModified ? new Date(lastModified) : null;
  const exportedOn = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
  return { stream: Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>), exportedOn };
}

/** Colonnes non sélectionnées supprimées AVANT l'assemblage des objets CSV. */
export function dgalInput(open: (s: typeof DGAL_SECTIONS[number]) => Promise<DgalDownload>,
  limits = { minRetained: 5000, maxFileBytes: 8 * 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024, maxRows: 100000 }): ImportInput<DgalRow> & { stats: DgalStats } {
  const stats: DgalStats = { files: [], duplicates: 0, retained: 0 }, manifest = createHash("sha256");
  let complete = false;
  async function* rows() {
    const unique = new Map<string, DgalRow>(); let totalBytes = 0;
    for (const section of DGAL_SECTIONS) {
      const started = Date.now(), { stream, exportedOn } = await open(section), fp = new Fingerprint(limits.maxFileBytes);
      const s: DgalFileStats = { section: section.code, url: DGAL_BASE + section.file, read: 0, usable: 0, missingSiret: 0,
        invalidSiren: 0, invalidApproval: 0, unknownCodes: 0, bytes: 0, sha256: "", exportedOn, seconds: 0 };
      const utf8 = new TextDecoder("utf-8", { fatal: true });
      const decode = new Transform({ transform(chunk, _e, done) { try { done(null, utf8.decode(chunk, { stream: true })); } catch { done(new Error("DGAL_ENCODING")); } },
        flush(done) { try { done(null, utf8.decode()); } catch { done(new Error("DGAL_ENCODING")); } } });
      const parser = parse({ bom: true, skip_empty_lines: true, max_record_size: 64 * 1024,
        columns: (headers: string[]) => {
          if (new Set(headers).size !== headers.length || Object.values(HEADERS).some(h => !headers.includes(h))) throw new Error("DGAL_HEADERS");
          return headers.map(h => Object.values(HEADERS).includes(h) ? h : false);
        } });
      const measured = Readable.from(fp.measure(stream));
      const pumped = pipeline(measured, decode, parser).then(() => null, () => new Error("DGAL_STREAM"));
      try {
        for await (const row of parser) {
          if (s.read >= limits.maxRows) throw new Error("DGAL_ROWS");
          const r = projectDgal(row, section.code, exportedOn, s);
          if (!r) continue;
          const key = `${r.siret}:${r.approval}:${r.section}`, previous = unique.get(key);
          if (previous) {
            stats.duplicates++;
            r.categories = [...new Set([...previous.categories, ...r.categories])].sort();
            r.associated = [...new Set([...previous.associated, ...r.associated])].sort();
          }
          unique.set(key, r); if (unique.size > limits.maxRows) throw new Error("DGAL_ROWS");
        }
        if (await pumped || !s.read) throw new Error("DGAL_INCOMPLETE_FILE");
        s.bytes = fp.bytes; totalBytes += s.bytes; if (totalBytes > limits.maxTotalBytes) throw new Error("DGAL_BYTES");
        s.sha256 = fp.finish(); s.seconds = (Date.now() - started) / 1000; stats.files.push(s);
        // La date d'export fait partie du contenu projeté et de son empreinte.
        manifest.update(`${section.file}:${exportedOn ?? "inconnue"}:${s.sha256}\n`);
      } finally { stream.destroy(); measured.destroy(); decode.destroy(); parser.destroy(); await pumped; }
    }
    const read = stats.files.reduce((n, s) => n + s.read, 0), usable = stats.files.reduce((n, s) => n + s.usable, 0);
    if (unique.size < limits.minRetained || usable / read < 0.95) throw new Error("DGAL_INCOMPLETE_SOURCE");
    stats.retained = unique.size; yield* unique.values(); complete = true;
  }
  return { rows: rows(), stats, fingerprint: () => { if (!complete) throw new Error("DGAL_INCOMPLETE_SOURCE"); return manifest.digest("hex"); } };
}

export const dgalWriter: DatasetWriter<DgalRow> = {
  async write(tx, id, rows) {
    // Le client postgres sérialise les tableaux jsonb lui-même.
    await tx`insert into dgal_approvals ${tx(rows.map(r => ({ ...r, import_id: id })))}
      on conflict (import_id, siret, approval, section) do update set categories = excluded.categories,
        associated = excluded.associated, exported_on = excluded.exported_on`;
  },
  async count(tx, id) { const r = await tx`select count(*)::int as count from dgal_approvals where import_id = ${id}`; return Number(r[0].count); },
  async prune(tx, id) { await tx`delete from dgal_approvals where import_id <> ${id}`; },
};
export async function importDgal(db: Sql) {
  const identity = { source: "dgal", version: "dgal-v1-ce", sourceUrl: DGAL_PAGE }, store = postgresImportStore(db, dgalWriter);
  const deadline = AbortSignal.timeout(25 * 60 * 1000); let publishing = false;
  try {
    const input = dgalInput(s => downloadDgal(s, AbortSignal.any([deadline, AbortSignal.timeout(60000)]))), prepared: DgalRow[] = [];
    for await (const row of input.rows) prepared.push(row);
    const sha256 = input.fingerprint(); publishing = true;
    const report = await runImport(identity, async () => ({ rows: (async function* () { yield* prepared; })(), fingerprint: () => sha256 }), store);
    return { ...report, stats: input.stats };
  } catch {
    if (!publishing) await store.transaction(identity, async () => { throw new Error("DGAL_SOURCE_FAILED"); }).catch(() => {});
    throw new Error("IMPORT_FAILED_PREVIOUS_DATA_PRESERVED");
  }
}
