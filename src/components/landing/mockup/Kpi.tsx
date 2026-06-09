import type { Kpi as KpiData } from "./mock-data";
import { TONE_COLOR } from "./mock-data";

/** Tuile KPI (Tableau de bord). */
export default function Kpi({ data }: { data: KpiData }) {
  return (
    <div className="rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2.5">
      <div
        className="text-[18px] font-bold leading-none"
        style={{ color: data.tone ? TONE_COLOR[data.tone] : "var(--kyb-text-hi)" }}
      >
        {data.value}
      </div>
      <div className="mt-1 text-[10.5px] leading-tight text-[var(--kyb-text-mid)]">
        {data.label}
      </div>
    </div>
  );
}
