import StatusBadge from "./StatusBadge";
import { ANALYSES, PRIORITY_TONE } from "./mock-data";

/** Section « Analyses » : analyses transversales avec niveau de priorité. */
export default function AnalysesPanel() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      {ANALYSES.map((a, i) => (
        <div
          key={i}
          className="rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-[12px] font-medium text-[var(--kyb-text-hi)]">
              {a.label}
            </span>
            <StatusBadge
              label={`Priorité ${a.priority}`}
              tone={PRIORITY_TONE[a.priority]}
            />
          </div>
          <p className="mt-1 text-[10.5px] text-[var(--kyb-text-mid)]">{a.desc}</p>
        </div>
      ))}
    </div>
  );
}
