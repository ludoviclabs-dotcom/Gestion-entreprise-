import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isDecpEnabled, isDemoMode } from "@/lib/env";
import { isValidSiren } from "@/lib/siren";
import { decpData } from "@/lib/ingestion/decp-data";
import type { ConnectorResult } from "./types";

/** Une requête paramétrée, un snapshot d’import et les deux rôles du SIREN. */
/** Les synthèses complètes et leurs 20 derniers marchés sont préparés à l’import. */
export function decpQuery(siren: string) {
  const empty = sql`json_build_object('total', 0, 'reliableAmount', 0, 'singleReliable', 0, 'grouped', 0, 'unreliable', 0, 'lastNotified', null, 'buyers', '[]'::jsonb, 'items', '[]'::jsonb)`;
  return sql`
    with latest as (
      select id, imported_at from open_data_imports where source = 'decp' and status = 'ok' order by imported_at desc limit 1
    ), matched as (
      select s.role, json_build_object('total', s.total, 'reliableAmount', s.reliable_amount,
        'singleReliable', s.single_reliable, 'grouped', s.grouped, 'unreliable', s.unreliable,
        'lastNotified', s.last_notified, 'buyers', s.buyers, 'items', s.items) as summary
      from decp_summaries s join latest l on s.import_id = l.id where s.siren = ${siren}
    )
    select l.imported_at, w.window_start::text, w.window_end::text, w.latest_file_month,
      (select status from open_data_imports where source = 'decp' order by coalesce(checked_at, started_at) desc limit 1) as last_status,
      coalesce((select summary from matched where role = 'holder'), ${empty}) as holder,
      coalesce((select summary from matched where role = 'buyer'), ${empty}) as buyer
    from (select 1) anchor left join latest l on true left join decp_windows w on w.import_id = l.id
  `;
}
export const decp = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isDecpEnabled()) return { raw: { status: "indisponible" }, endpoint: "fixture:decp", httpStatus: 0, isFixture: true };
    const valid = typeof siren === "string" && /^\d{9}$/.test(siren) && siren !== "000000000" && isValidSiren(siren);
    const endpoint = `${valid ? "db:decp_summaries?siren=" : "decp:"}${valid ? siren : "invalide"}`;
    const failed = (suffix: string, status = "indisponible", httpStatus = 503): ConnectorResult<unknown> => ({
      raw: { status }, endpoint: `${endpoint} (${suffix})`, httpStatus, isFixture: false,
    });
    if (!valid) return failed("erreur 400", "indisponible", 400);
    try {
      const result = await getDb().execute(decpQuery(siren)), row = result.rows[0];
      if (!row) return failed("schéma non reconnu");
      if (!row.imported_at) return row.last_status === "failed" ? failed("exception") : failed("source non importée", "non_importe");
      const parsed = decpData.safeParse({ status: "ok", siren, importedAt: new Date(row.imported_at as string).toISOString(),
        windowStart: row.window_start, windowEnd: row.window_end, latestFileMonth: row.latest_file_month, holder: row.holder, buyer: row.buyer });
      if (!parsed.success) return failed("schéma non reconnu");
      return { raw: parsed.data, endpoint, httpStatus: 200, isFixture: false };
    } catch { return failed("exception"); }
  },
};
