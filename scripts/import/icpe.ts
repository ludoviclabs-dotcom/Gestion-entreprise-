import { Readable } from "node:stream";
import type { Sql } from "postgres";
import { isValidSiren } from "../../src/lib/siren";
import { download, Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

export const ICPE_URL = "https://www.georisques.gouv.fr/api/v1/installations_classees";
export type IcpeRow = {
  code_aiot: string; siret: string; siren: string; name: string | null; commune: string | null;
  naf: string | null; regime: string | null; seveso: string | null; ied: boolean | null;
  national_priority: boolean | null; status: string | null; inspections: number; last_inspection: string | null;
};
export type IcpeStats = { received: number; nonIcpe: number; unusableIdentifier: number };
const text = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || v.length > 4000) throw new Error("ICPE_INVALID_FIELD");
  return v.trim() || null;
};
const bool = (v: unknown): boolean | null => {
  if (v == null) return null;
  if (typeof v !== "boolean") throw new Error("ICPE_INVALID_BOOLEAN");
  return v;
};
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("ICPE_INVALID_RECORD");
  return v as Record<string, unknown>;
};
function day(v: unknown): string | null {
  const s = text(v);
  if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)) {
    throw new Error("ICPE_INVALID_DATE");
  }
  return s;
}
export function projectIcpe(r: Record<string, unknown>, stats: IcpeStats): IcpeRow | null {
  const code_aiot = text(r.codeAIOT);
  if (!code_aiot || code_aiot.length > 100) throw new Error("ICPE_MISSING_NATURAL_KEY");
  const regime = text(r.regime);
  if (regime && /^non\s*icpe$/i.test(regime)) { stats.nonIcpe++; return null; }
  const siret = text(r.siret);
  // Rapprochement sur le SIREN : NIC non interprété, pas de filtre sur les EI.
  if (!siret || !/^\d{14}$/.test(siret) || siret.startsWith("000000000") || !isValidSiren(siret.slice(0, 9))) {
    stats.unusableIdentifier++; return null;
  }
  if (r.inspections != null && !Array.isArray(r.inspections)) throw new Error("ICPE_INVALID_INSPECTIONS");
  const inspections = (r.inspections ?? []) as unknown[];
  let last_inspection: string | null = null;
  for (const inspection of inspections) {
    const date = day(object(inspection).dateInspection);
    if (date && (!last_inspection || date > last_inspection)) last_inspection = date;
  }
  // Projection explicite, jamais d'adresses, contacts, rapports ou rubriques.
  return { code_aiot, siret, siren: siret.slice(0, 9), name: text(r.raisonSociale), commune: text(r.commune),
    naf: text(r.codeNaf), regime, seveso: text(r.statutSeveso), ied: bool(r.ied),
    national_priority: bool(r.prioriteNationale), status: text(r.etatActivite), inspections: inspections.length, last_inspection };
}

type PageReader = (page: number, pageSize: number) => Promise<Readable>;
/** Une seule page JSON en mémoire, total borné, liens next jamais suivis. */
export function icpeInput(readPage: PageReader, options: { pageSize?: number; minimumRecords?: number } = {}): ImportInput<IcpeRow> & { stats: IcpeStats } {
  const pageSize = options.pageSize ?? 1000;
  const minimum = options.minimumRecords ?? 1000;
  const fp = new Fingerprint(384 * 1024 * 1024);
  const stats: IcpeStats = { received: 0, nonIcpe: 0, unusableIdentifier: 0 };
  let complete = false;
  async function* rows(): AsyncGenerator<IcpeRow> {
    let total = 0, pages = 1;
    // Au maximum 1 million d'identifiants courts : détecte une page répétée ou
    // un décalage de pagination sans garder les lignes nationales en mémoire.
    const seen = new Set<string>();
    for (let page = 1; page <= pages; page++) {
      const source = await readPage(page, pageSize);
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const chunk of fp.measure(source)) {
          bytes += chunk.byteLength;
          if (bytes > 32 * 1024 * 1024) throw new Error("ICPE_PAGE_TOO_LARGE");
          chunks.push(Buffer.from(chunk));
        }
      } finally { source.destroy(); }
      const data = object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      chunks.length = 0;
      if (page === 1) {
        if (!Number.isSafeInteger(data.results) || Number(data.results) < minimum || Number(data.results) > 1_000_000) throw new Error("ICPE_INVALID_TOTAL");
        total = Number(data.results); pages = Math.ceil(total / pageSize);
        if (pages > 1000) throw new Error("ICPE_TOO_MANY_PAGES");
      }
      const expected = Math.min(pageSize, total - (page - 1) * pageSize);
      if (data.page !== page || data.results !== total || data.total_pages !== pages || !Array.isArray(data.data) || data.data.length !== expected ||
        (page < pages ? typeof data.next !== "string" || !data.next : data.next != null && data.next !== "")) {
        throw new Error("ICPE_INCONSISTENT_PAGINATION");
      }
      for (const value of data.data) {
        const row = object(value), id = text(row.codeAIOT);
        if (!id || id.length > 100 || seen.has(id)) throw new Error("ICPE_DUPLICATE_OR_MISSING_ID");
        seen.add(id); stats.received++;
        const projected = projectIcpe(row, stats);
        if (projected) yield projected;
      }
    }
    if (stats.received !== total) throw new Error("ICPE_INCOMPLETE_SOURCE");
    complete = true;
  }
  return { rows: rows(), stats, fingerprint: () => {
    if (!complete) throw new Error("ICPE_INCOMPLETE_SOURCE");
    return fp.finish();
  } };
}

export function openIcpeInput() {
  const overall = AbortSignal.timeout(25 * 60 * 1000);
  return icpeInput((page, size) => download(`${ICPE_URL}?page=${page}&page_size=${size}`,
    AbortSignal.any([overall, AbortSignal.timeout(90_000)])));
}
export const icpeWriter: DatasetWriter<IcpeRow> = {
  async write(tx, importId, rows) {
    const unique = new Map(rows.map(r => [r.code_aiot, r]));
    await tx`insert into icpe_sites ${tx([...unique.values()].map(r => ({ ...r, import_id: importId })))}
      on conflict (import_id, code_aiot) do update set siret = excluded.siret, siren = excluded.siren,
        name = excluded.name, commune = excluded.commune, naf = excluded.naf, regime = excluded.regime,
        seveso = excluded.seveso, ied = excluded.ied, national_priority = excluded.national_priority,
        status = excluded.status, inspections = excluded.inspections, last_inspection = excluded.last_inspection`;
  },
  async count(tx, id) { const r = await tx`select count(*)::int as count from icpe_sites where import_id = ${id}`; return Number(r[0].count); },
  async prune(tx, id) { await tx`delete from icpe_sites where import_id <> ${id}`; },
};
export async function importIcpe(db: Sql) {
  const input = openIcpeInput();
  const report = await runImport({ source: "icpe", version: "icpe-v1", sourceUrl: ICPE_URL },
    async () => input, postgresImportStore(db, icpeWriter));
  return { ...report, stats: input.stats };
}
