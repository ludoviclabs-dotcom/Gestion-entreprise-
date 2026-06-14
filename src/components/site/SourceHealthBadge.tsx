import { Badge } from "@/components/ui/badge";

const EMERALD = "#10b981";
const AMBER = "#f59e0b";

/**
 * Badge live/démo d'une source. Markup extrait de la page Réglages
 * (src/app/(app)/reglages/page.tsx) pour une vérité d'affichage unique.
 */
export function SourceHealthBadge({
  live,
  label,
}: {
  live: boolean;
  label?: string;
}) {
  const color = live ? EMERALD : AMBER;
  return (
    <Badge variant="outline" className="shrink-0 border-border" style={{ color }}>
      <span
        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label ?? (live ? "Live" : "Démo")}
    </Badge>
  );
}
