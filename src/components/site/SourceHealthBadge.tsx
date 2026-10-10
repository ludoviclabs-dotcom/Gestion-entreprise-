import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Badge live/démo d'une source. Markup extrait de la page Réglages
 * (src/app/(app)/reglages/page.tsx) pour une vérité d'affichage unique.
 * Live = succès, démo = vigilance (donnée de démonstration, pas une erreur).
 */
export function SourceHealthBadge({
  live,
  label,
}: {
  live: boolean;
  label?: string;
}) {
  return (
    <StatusBadge tone={live ? "success" : "vigilance"} className="shrink-0">
      {label ?? (live ? "Live" : "Démo")}
    </StatusBadge>
  );
}
