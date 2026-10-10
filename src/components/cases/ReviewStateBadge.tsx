import { StatusBadge } from "@/components/ui/status-badge";
import type { Tone } from "@/lib/design/tone";
import { REVIEW_STATE_LABELS, type ReviewState } from "@/lib/audit/journal";

/**
 * Badge de l'axe de REVUE (P4) — distinct du statut d'ingestion. Affiché à côté
 * de CaseStatusBadge ; les deux axes coexistent. Composant serveur.
 */
const TONE: Record<ReviewState, Tone> = {
  a_trier: "neutral",
  en_revue: "vigilance",
  conclu: "success",
};

export default function ReviewStateBadge({ state }: { state: ReviewState }) {
  return <StatusBadge tone={TONE[state]}>{REVIEW_STATE_LABELS[state]}</StatusBadge>;
}
