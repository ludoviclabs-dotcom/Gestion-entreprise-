import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isCaminoEnabled, isDemoMode } from "@/lib/env";
import { isValidSiren } from "@/lib/siren";
import { caminoData } from "@/lib/ingestion/camino-data";
import type { ConnectorResult } from "./types";

const empty = { status: "indisponible" };
export const camino = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isCaminoEnabled()) return {
      raw: empty, endpoint: "fixture:camino", httpStatus: 0, isFixture: true,
    };
    const valid = /^\d{9}$/.test(siren) && siren !== "000000000" && isValidSiren(siren);
    const endpoint = `db:camino_titres?siren=${valid ? siren : "invalide"}`;
    const failed = (suffix: string, httpStatus = 503): ConnectorResult<unknown> => ({
      raw: empty, endpoint: `${endpoint} (${suffix})`, httpStatus, isFixture: false,
    });
    if (!valid) return failed("erreur 400", 400);
    try {
      // Une seule requête/snapshot SQL : le pruning d'un import concurrent ne peut
      // intercaler un ancien en-tête et des lignes déjà supprimées.
      const result = await getDb().execute(sql`
        with latest as (
          select id, imported_at from open_data_imports
          where source = 'camino' and status = 'ok' order by imported_at desc limit 1
        ), matched as materialized (
          select t.* from camino_titres t join latest l on t.import_id = l.id where t.siren = ${siren}
        ), limited as (
          select * from matched order by greatest(starts_on, ends_on) desc nulls last, title_id limit 20
        )
        select l.imported_at,
          (select count(*)::int from matched) as total,
          coalesce((select json_agg(s order by label) from (select status as label, count(*)::int as count from matched group by status) s), '[]'::json) as by_status,
          coalesce((select json_agg(s order by label) from (select domain as label, count(*)::int as count from matched group by domain) s), '[]'::json) as by_domain,
          (select max(ends_on)::text from matched where status like 'valide%') as valid_until,
          coalesce((select json_agg(json_build_object('id', title_id, 'name', name, 'type', type,
            'domain', domain, 'status', status, 'startsOn', starts_on, 'endsOn', ends_on,
            'holder', holder, 'operator', operator) order by greatest(starts_on, ends_on) desc nulls last, title_id) from limited), '[]'::json) as items
        from latest l
      `);
      const row = result.rows[0];
      if (!row) return failed("source non importée");
      if (!row.imported_at) return failed("schéma non reconnu");
      const importedAt = new Date(row.imported_at as string).toISOString();
      const parsed = caminoData.safeParse({ status: "ok", importedAt, total: row.total,
        byStatus: row.by_status, byDomain: row.by_domain, validUntil: row.valid_until, items: row.items });
      if (!parsed.success) return failed("schéma non reconnu");
      return { raw: parsed.data, endpoint, httpStatus: 200, isFixture: false };
    } catch {
      return failed("exception");
    }
  },
};
