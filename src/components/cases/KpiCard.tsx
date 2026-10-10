import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

/**
 * Carte indicateur. `accent` : référence CSS d'une teinte (`var(--primary)` par
 * défaut, ou un alias historique `var(--red)` / `var(--emerald)`). La pastille
 * d'icône est teintée à 14 % via color-mix — l'ancienne concaténation hex+alpha
 * (`${accent}1f`) était invalide avec une variable CSS.
 */
export default function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "var(--primary)",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className="flex size-8 items-center justify-center rounded-md"
          style={{
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
            color: accent,
          }}
        >
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold tabular-nums">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
