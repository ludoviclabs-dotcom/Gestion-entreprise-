import { StatusBadge } from "@/components/ui/status-badge";
import { EVIDENCE_TONE } from "@/lib/design/domain-tones";
import { EVIDENCE_LABELS, isHypothesis } from "@/lib/graph/graph-types";
import type { EvidenceLevel } from "@/lib/graph/graph-types";

/**
 * Niveau de preuve. La preuve n'est pas un niveau de risque : confirmé = accent,
 * inféré = vigilance + « à vérifier », déclaré / simulé = neutre. Jamais rouge.
 */
export default function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  return (
    <StatusBadge tone={EVIDENCE_TONE[level]} className="rounded-full">
      {EVIDENCE_LABELS[level]}
      {isHypothesis(level) && (
        <span className="text-subtle">· à vérifier</span>
      )}
    </StatusBadge>
  );
}
