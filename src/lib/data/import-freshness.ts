import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const IMPORT_LABELS = { camino: "Titres miniers (Camino)", icpe: "Installations classées nationales (ICPE)",
  tresor_gels: "Registre national des gels (DG Trésor)" } as const;
export type ImportFreshness = {
  source: string;
  label: string;
  state: "unconfigured" | "missing" | "unavailable" | "ok";
  importedAt: string | null;
  checkedAt: string | null;
  recordCount: number;
  lastAttemptFailed: boolean;
};
type ImportRow = {
  source: string; status: string; imported_at: string | Date | null;
  checked_at: string | Date | null; record_count: number; last_status: string;
};
const iso = (v: string | Date | null): string | null => {
  if (!v) return null;
  const date = new Date(v);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export function importFreshness(rows: ImportRow[], available: "ready" | "unconfigured" | "unavailable"): ImportFreshness[] {
  return Object.entries(IMPORT_LABELS).map(([source, label]) => {
    const row = rows.find((r) => r.source === source);
    const importedAt = iso(row?.imported_at ?? null);
    return {
      source, label,
      state: available !== "ready" ? available : row?.status === "ok" && importedAt ? "ok" : "missing",
      importedAt, checkedAt: iso(row?.checked_at ?? null),
      recordCount: Number(row?.record_count ?? 0), lastAttemptFailed: row?.last_status === "failed",
    };
  });
}

/** Ni succès inventé si table absente, ni secret/erreur SQL dans la page. */
export async function getImportFreshness(): Promise<ImportFreshness[]> {
  if (!process.env.DATABASE_URL) return importFreshness([], "unconfigured");
  try {
    const rows = await getDb().execute(sql`
      with latest as (
        select distinct on (source) source, status as last_status
        from open_data_imports order by source, coalesce(checked_at, started_at) desc
      ), successful as (
        select distinct on (source) source, status, imported_at, checked_at, record_count
        from open_data_imports where status = 'ok' order by source, imported_at desc
      )
      select l.source, l.last_status, s.status, s.imported_at, s.checked_at, s.record_count
      from latest l left join successful s using (source)
    `);
    return importFreshness(rows.rows as ImportRow[], "ready");
  } catch {
    return importFreshness([], "unavailable");
  }
}
