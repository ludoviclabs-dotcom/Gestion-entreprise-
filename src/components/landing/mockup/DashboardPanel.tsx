import Kpi from "./Kpi";
import { KPIS, RECENT_DOSSIERS } from "./mock-data";

/** Section « Tableau de bord » : KPIs + dossiers récents. */
export default function DashboardPanel() {
  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {KPIS.map((k, i) => (
          <Kpi key={i} data={k} />
        ))}
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--kyb-text-low)]">
          Dossiers récents
        </div>
        <div className="flex flex-col gap-1.5">
          {RECENT_DOSSIERS.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[12px] text-[var(--kyb-text-hi)]">
                  {d.name}
                </div>
                <div className="text-[10px] text-[var(--kyb-text-low)]">
                  SIREN {d.siren}
                </div>
              </div>
              <span className="shrink-0 text-[12px] font-semibold text-[var(--kyb-text-hi)]">
                {d.score}
                <span className="text-[10px] text-[var(--kyb-text-low)]">/100</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
