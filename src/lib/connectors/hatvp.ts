import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isHatvpEnabled, isDemoMode } from "@/lib/env";
import { isValidSiren } from "@/lib/siren";
import { hatvpData } from "@/lib/ingestion/hatvp-data";
import type { ConnectorResult } from "./types";

export const hatvp = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isHatvpEnabled()) return { raw: { status: "indisponible" }, endpoint: "fixture:hatvp", httpStatus: 0, isFixture: true };
    const valid = /^\d{9}$/.test(siren) && siren !== "000000000" && isValidSiren(siren);
    const endpoint = `db:hatvp_organisations?siren=${valid ? siren : "invalide"}`;
    const failed = (suffix: string, status = "indisponible", httpStatus = 503): ConnectorResult<unknown> => ({
      raw: { status }, endpoint: `${endpoint} (${suffix})`, httpStatus, isFixture: false,
    });
    if (!valid) return failed("erreur 400", "indisponible", 400);
    try {
      // En-tête et organisation dans un seul snapshot paramétré. Un échec initial
      // est distinct d'un jeu jamais importé ; un succès précédent reste servi.
      const result = await getDb().execute(sql`
        with latest as (
          select id, imported_at from open_data_imports
          where source = 'hatvp' and status = 'ok' order by imported_at desc limit 1
        )
        select l.imported_at,
          (select status from open_data_imports where source = 'hatvp'
            order by coalesce(checked_at, started_at) desc limit 1) as last_status,
          case when h.siren is null then null else json_build_object(
            'siren', h.siren, 'categoryCode', h.category_code, 'categoryLabel', h.category_label, 'categoryGroup', h.category_group,
            'firstPublishedOn', h.first_published_on, 'lastActivityPublishedOn', h.last_activity_published_on,
            'activitiesPublished', h.activities_published, 'lastExerciseEnd', h.last_exercise_end,
            'activityCountLast', h.activity_count_last, 'noActivityDeclared', h.no_activity_declared,
            'ceasedOn', h.ceased_on, 'deregistrationReason', h.deregistration_reason) end as organisation
        from (select 1) anchor left join latest l on true
        left join hatvp_organisations h on h.import_id = l.id and h.siren = ${siren}
      `);
      const row = result.rows[0];
      if (!row) return failed("schéma non reconnu");
      if (!row.imported_at) return row.last_status === "failed" ? failed("exception") : failed("source non importée", "non_importe");
      const importedAt = new Date(row.imported_at as string).toISOString();
      const parsed = hatvpData.safeParse({ status: "ok", importedAt, organisation: row.organisation });
      if (!parsed.success || (parsed.data.organisation && parsed.data.organisation.siren !== siren)) return failed("schéma non reconnu");
      return { raw: parsed.data, endpoint, httpStatus: 200, isFixture: false };
    } catch { return failed("exception"); }
  },
};
