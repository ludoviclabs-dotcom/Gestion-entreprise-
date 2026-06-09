import { Check } from "lucide-react";
import { ANALYSIS_ACTIONS, ANALYSIS_SYNTHESIS } from "./mock-data";

/** Onglet « Analyse » : synthèse analyste + actions recommandées. */
export default function AnalysisPanel() {
  return (
    <div className="px-4 py-3 text-[12px] leading-relaxed text-[var(--kyb-text-mid)]">
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--kyb-violet-soft)]">
        Synthèse analyste
      </div>
      <ul className="mb-3 flex flex-col gap-1.5">
        {ANALYSIS_SYNTHESIS.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--kyb-violet-soft)]" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--kyb-text-low)]">
        Actions recommandées
      </div>
      <ul className="flex flex-col gap-1">
        {ANALYSIS_ACTIONS.map((a, i) => (
          <li key={i} className="flex items-center gap-2">
            <Check size={13} className="shrink-0 text-[var(--kyb-green)]" />
            <span className="text-[11.5px] text-[var(--kyb-text-hi)]">{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
