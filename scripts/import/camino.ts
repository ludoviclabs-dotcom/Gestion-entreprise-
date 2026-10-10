import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import type { Sql } from "postgres";
import { isValidSiren } from "../../src/lib/siren";
import { download, Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

export const CAMINO_URL = "https://camino.beta.gouv.fr/apiUrl/titres?format=csv";
export type CaminoRow = {
  title_id: string; siren: string; name: string; type: string; domain: string;
  status: string; substances: string; departments: string;
  starts_on: string | null; ends_on: string | null; holder: boolean; operator: boolean;
};
const REQUIRED = ["id", "nom", "type", "domaine", "statut", "substances", "departements",
  "date_debut", "date_fin", "titulaires_legal", "amodiataires_legal"];

function date(value: string): string | null {
  if (!value.trim()) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  if (!iso || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) {
    throw new Error("CAMINO_INVALID_DATE");
  }
  return iso;
}
const sirens = (value: string): string[] => [...new Set(value.split(";").map(s => s.trim())
  .filter(s => /^\d{9}$/.test(s) && s !== "000000000" && isValidSiren(s)))];

/** Liste blanche : aucune identité de personne, adresse, contact ou géométrie. */
export function projectCamino(r: Record<string, string>): CaminoRow[] {
  const title_id = r.id.trim();
  if (!title_id || title_id.length > 200) throw new Error("CAMINO_INVALID_ID");
  const holders = new Set(sirens(r.titulaires_legal));
  const operators = new Set(sirens(r.amodiataires_legal));
  const starts_on = date(r.date_debut), ends_on = date(r.date_fin);
  const fields = { title_id, name: r.nom.trim(), type: r.type.trim(), domain: r.domaine.trim(),
    status: r.statut.trim(), substances: r.substances.trim(), departments: r.departements.trim(), starts_on, ends_on };
  if (Object.values(fields).some(v => typeof v === "string" && v.length > 4000)) throw new Error("CAMINO_FIELD_TOO_LONG");
  // Une entreprise peut cumuler les deux rôles ; un seul titre par SIREN.
  return [...new Set([...holders, ...operators])].map(siren => ({ ...fields, siren,
    holder: holders.has(siren), operator: operators.has(siren) }));
}

/** CSV strict, flux borné et annulation propagée si l'écriture échoue. */
export function caminoInput(source: Readable, minimumTitles = 1000): ImportInput<CaminoRow> {
  const fp = new Fingerprint(32 * 1024 * 1024);
  let complete = false;
  async function* rows(): AsyncGenerator<CaminoRow> {
    const parser = parse({ bom: true, skip_empty_lines: true, max_record_size: 2 * 1024 * 1024,
      columns: (headers: string[]) => {
        if (new Set(headers).size !== headers.length || REQUIRED.some(h => !headers.includes(h))) {
          throw new Error("CAMINO_INVALID_HEADERS");
        }
        return headers;
      } });
    const measured = Readable.from(fp.measure(source));
    // Le catch est attaché immédiatement : pas de rejet non géré pendant un lot SQL.
    const pumped = pipeline(measured, parser).then(() => null, () => new Error("CAMINO_INVALID_STREAM"));
    let titles = 0;
    try {
      for await (const row of parser) {
        titles++;
        yield* projectCamino(row as Record<string, string>);
      }
      if (await pumped || titles < minimumTitles) throw new Error("CAMINO_INCOMPLETE_SOURCE");
      complete = true;
    } finally {
      source.destroy(); measured.destroy(); parser.destroy();
      await pumped;
    }
  }
  return { rows: rows(), fingerprint: () => {
    if (!complete) throw new Error("CAMINO_INCOMPLETE_SOURCE");
    return fp.finish();
  } };
}

export const caminoWriter: DatasetWriter<CaminoRow> = {
  async write(tx, importId, rows) {
    // Un même titre peut apparaître plusieurs fois dans un lot : PostgreSQL interdit
    // de mettre à jour la même clé deux fois dans un INSERT ON CONFLICT.
    const unique = new Map(rows.map(r => [`${r.title_id}:${r.siren}`, r]));
    await tx`insert into camino_titres ${tx([...unique.values()].map(r => ({ ...r, import_id: importId })))}
      on conflict (import_id, title_id, siren) do update set
        name = excluded.name, type = excluded.type, domain = excluded.domain, status = excluded.status,
        substances = excluded.substances, departments = excluded.departments,
        starts_on = excluded.starts_on, ends_on = excluded.ends_on,
        holder = excluded.holder, operator = excluded.operator`;
  },
  async count(tx, id) {
    const rows = await tx`select count(*)::int as count from camino_titres where import_id = ${id}`;
    return Number(rows[0].count);
  },
  async prune(tx, id) { await tx`delete from camino_titres where import_id <> ${id}`; },
};

export async function importCamino(db: Sql) {
  return runImport({ source: "camino", version: "camino-v1", sourceUrl: CAMINO_URL },
    async () => caminoInput(await download(CAMINO_URL, AbortSignal.timeout(25 * 60 * 1000))),
    postgresImportStore(db, caminoWriter));
}
