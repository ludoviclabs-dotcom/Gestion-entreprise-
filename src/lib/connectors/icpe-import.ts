import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isDemoMode, isGeorisquesEnabled, isIcpeImportEnabled } from "@/lib/env";
import { isValidSiren } from "@/lib/siren";
import { importedIcpeData } from "@/lib/ingestion/icpe-data";
import type { ConnectorResult } from "./types";

export const icpeImport = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isGeorisquesEnabled() || !isIcpeImportEnabled()) return {
      raw: { status: "indisponible" }, endpoint: "fixture:icpe-import", httpStatus: 0, isFixture: true,
    };
    const valid = /^\d{9}$/.test(siren) && siren !== "000000000" && isValidSiren(siren);
    const endpoint = `db:icpe_sites?siren=${valid ? siren : "invalide"}`;
    const failed = (reason: string, httpStatus = 503): ConnectorResult<unknown> => ({
      raw: { status: reason === "source non importée" ? "non_importe" : "indisponible" },
      endpoint: `${endpoint} (${reason})`, httpStatus, isFixture: false,
    });
    if (!valid) return failed("erreur 400", 400);
    try {
      const result = await getDb().execute(sql`
        with latest as (
          select id, imported_at from open_data_imports where source = 'icpe' and status = 'ok' order by imported_at desc limit 1
        ), matched as materialized (
          select s.* from icpe_sites s join latest l on s.import_id = l.id where s.siren = ${siren}
        ), limited as (select * from matched order by last_inspection desc nulls last, code_aiot limit 20)
        select l.imported_at,
          (select count(*)::int from matched) as total,
          (select count(distinct siret)::int from matched) as establishments,
          coalesce((select json_agg(g order by label) from (select regime as label, count(*)::int as count from matched group by regime) g), '[]'::json) as by_regime,
          coalesce((select json_agg(g order by label) from (select status as label, count(*)::int as count from matched group by status) g), '[]'::json) as by_status,
          coalesce((select json_agg(g order by label) from (select seveso as label, count(*)::int as count from matched group by seveso) g), '[]'::json) as by_seveso,
          (select count(*)::int from matched where ied is true) as ied,
          (select count(*)::int from matched where national_priority is true) as national_priority,
          (select coalesce(sum(inspections), 0)::int from matched) as inspections,
          (select max(last_inspection)::text from matched) as last_inspection,
          coalesce((select json_agg(json_build_object('codeAiot', code_aiot, 'siret', siret, 'name', name,
            'commune', commune, 'regime', regime, 'seveso', seveso, 'ied', ied, 'nationalPriority', national_priority,
            'status', status, 'inspections', inspections, 'lastInspection', last_inspection)
            order by last_inspection desc nulls last, code_aiot) from limited), '[]'::json) as sites
        from latest l
      `);
      const r = result.rows[0];
      if (!r) return failed("source non importée");
      if (!r.imported_at) return failed("schéma non reconnu");
      const parsed = importedIcpeData.safeParse({ status: "ok", coverage: "national-import",
        importedAt: new Date(r.imported_at as string).toISOString(), total: r.total, establishments: r.establishments,
        byRegime: r.by_regime, byStatus: r.by_status, bySeveso: r.by_seveso, ied: r.ied, nationalPriority: r.national_priority,
        inspections: r.inspections, lastInspection: r.last_inspection, sites: r.sites });
      if (!parsed.success) return failed("schéma non reconnu");
      if (parsed.data.sites.some(s => !s.siret.startsWith(siren))) return failed("schéma non reconnu");
      return { raw: parsed.data, endpoint, httpStatus: 200, isFixture: false };
    } catch { return failed("exception"); }
  },
};
