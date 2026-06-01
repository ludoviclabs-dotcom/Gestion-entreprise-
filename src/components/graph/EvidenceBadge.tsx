import { EVIDENCE_LABELS, isHypothesis } from "@/lib/graph/graph-types";
import type { EvidenceLevel } from "@/lib/graph/graph-types";

const COLORS: Record<EvidenceLevel, string> = {
  confirmed: "#10b981",
  declared: "#38bdf8",
  inferred: "#f59e0b",
  simulated: "#ef4444",
};

export default function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const color = COLORS[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${color}22`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {EVIDENCE_LABELS[level]}
      {isHypothesis(level) && (
        <span className="text-[var(--muted-foreground)]">· à vérifier</span>
      )}
    </span>
  );
}
