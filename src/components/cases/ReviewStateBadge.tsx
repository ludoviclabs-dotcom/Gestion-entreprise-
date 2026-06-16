import { REVIEW_STATE_LABELS, type ReviewState } from "@/lib/audit/journal";

/**
 * Badge de l'axe de REVUE (P4) — distinct du statut d'ingestion. Affiché à côté
 * de CaseStatusBadge ; les deux axes coexistent. Composant serveur.
 */
const STYLE: Record<ReviewState, { bg: string; fg: string }> = {
  a_trier: { bg: "#64748b22", fg: "#94a3b8" },
  en_revue: { bg: "#f59e0b22", fg: "#f59e0b" },
  conclu: { bg: "#10b98122", fg: "#10b981" },
};

export default function ReviewStateBadge({ state }: { state: ReviewState }) {
  const s = STYLE[state];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {REVIEW_STATE_LABELS[state]}
    </span>
  );
}
