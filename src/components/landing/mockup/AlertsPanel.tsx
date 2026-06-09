import StatusBadge from "./StatusBadge";
import { ALERTS, PRIORITY_TONE, TONE_COLOR } from "./mock-data";

/** Section « Alertes » : alertes avec niveau de gravité. */
export default function AlertsPanel() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      {ALERTS.map((a, i) => {
        const tone = PRIORITY_TONE[a.severity];
        return (
          <div
            key={i}
            className="flex gap-3 rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: TONE_COLOR[tone] }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-[12px] font-medium text-[var(--kyb-text-hi)]">
                  {a.label}
                </span>
                <StatusBadge label={`Gravité ${a.severity}`} tone={tone} />
              </div>
              <p className="mt-1 text-[10.5px] text-[var(--kyb-text-mid)]">
                {a.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
