import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isDemoMode, isDgalEnabled } from "@/lib/env";
import { isValidSiren } from "@/lib/siren";
import { dgalData } from "@/lib/ingestion/dgal-data";
import type { ConnectorResult } from "./types";
/** Un seul snapshot SQL : dernier succès, deux décomptes exacts, vingt couples site/agrément. */
export function dgalQuery(siren: string) {
  return sql`with latest as (
    select id, imported_at, coalesce(checked_at, imported_at) as observed_at from open_data_imports
    where source = 'dgal' and status = 'ok' order by imported_at desc limit 1
  ), matched as materialized (
    select a.* from dgal_approvals a join latest l on a.import_id = l.id where a.siren = ${siren}
  ), sites as (
    select siret, approval, min(exported_on)::text as exported_on,
      json_agg(json_build_object('section', section, 'categories', categories, 'associated', associated) order by section) as activities
    from matched group by siret, approval
  ), limited as (select * from sites order by siret, approval limit 20)
  select l.imported_at, l.observed_at,
    (select status from open_data_imports where source = 'dgal' order by coalesce(checked_at, started_at) desc limit 1) as last_status,
    (select count(distinct siret)::int from matched) as total_sites,
    (select count(*)::int from sites) as total_approvals,
    coalesce((select json_agg(s order by section) from (select section, count(distinct siret)::int as count from matched group by section) s), '[]'::json) as by_section,
    coalesce((select json_agg(json_build_object('siret', siret, 'approval', approval, 'exportedOn', exported_on, 'activities', activities) order by siret, approval) from limited), '[]'::json) as items
  from (select 1) anchor left join latest l on true`;
}
export const dgal = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isDgalEnabled()) return { raw: { status: "indisponible" }, endpoint: "fixture:dgal", httpStatus: 0, isFixture: true };
    const valid = typeof siren === "string" && /^\d{9}$/.test(siren) && siren !== "000000000" && isValidSiren(siren);
    const endpoint = valid ? `db:dgal_approvals?siren=${siren}` : "dgal:invalide";
    const failed = (suffix: string, status = "indisponible", httpStatus = 503): ConnectorResult<unknown> => ({ raw: { status }, endpoint: `${endpoint} (${suffix})`, httpStatus, isFixture: false });
    if (!valid) return failed("erreur 400", "indisponible", 400);
    try {
      const { rows } = await getDb().execute(dgalQuery(siren)), row = rows[0];
      if (!row) return failed("schéma non reconnu");
      if (!row.imported_at) return row.last_status === "failed" ? failed("exception") : failed("source non importée", "non_importe");
      const parsed = dgalData.safeParse({ status: "ok", siren, importedAt: new Date(row.imported_at as string).toISOString(),
        observedAt: new Date(row.observed_at as string).toISOString(), totalSites: row.total_sites, totalApprovals: row.total_approvals,
        bySection: row.by_section, items: row.items });
      if (!parsed.success) return failed("schéma non reconnu");
      return { raw: parsed.data, endpoint, httpStatus: 200, isFixture: false };
    } catch { return failed("exception"); }
  },
};
