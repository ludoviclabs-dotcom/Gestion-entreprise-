import StatusBadge from "./StatusBadge";
import { EVIDENCE_ITEMS, TONE_COLOR } from "./mock-data";

/** Onglet « Preuve » : liste/timeline de preuves avec statut + traçabilité. */
export default function EvidenceTimeline() {
  return (
    <ol className="flex flex-col gap-2 px-4 py-3">
      {EVIDENCE_ITEMS.map((it, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
        >
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: TONE_COLOR[it.tone] }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="text-[12px] font-medium text-[var(--kyb-text-hi)]">
                {it.label}
              </span>
              <StatusBadge label={it.statusLabel} tone={it.tone} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--kyb-text-low)]">
              <span>Horodatage : {it.timestamp}</span>
              <span>Source : {it.source}</span>
              <span>Confiance : {it.confidence}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
