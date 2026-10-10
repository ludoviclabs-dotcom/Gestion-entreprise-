import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * État de chargement. Annoncé aux lecteurs d'écran (`role="status"`,
 * `aria-live="polite"`) ; le visuel est un squelette (pas de rotation décorative).
 * Sous `prefers-reduced-motion`, le pulse du squelette est neutralisé globalement.
 *
 *   rows   — lignes de squelette (tableaux, listes) ;
 *   block  — un bloc de contenu (panneau) ;
 *   inline — petit indicateur + libellé, dans une barre d'outils / un bouton.
 */
export default function LoadingState({
  label = "Chargement…",
  variant = "block",
  rows = 4,
  className,
}: {
  label?: string;
  variant?: "rows" | "block" | "inline";
  rows?: number;
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <span
        role="status"
        aria-live="polite"
        data-slot="loading-state"
        className={cn(
          "inline-flex items-center gap-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-slot="loading-state"
      className={cn("w-full", variant === "rows" ? "space-y-2 p-3" : "space-y-3 p-4", className)}
    >
      <span className="sr-only">{label}</span>
      {variant === "block" ? <Skeleton className="h-5 w-1/3" /> : null}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(variant === "rows" ? "h-9 w-full" : "h-4", variant === "block" && i % 2 === 1 ? "w-4/5" : "w-full")}
        />
      ))}
    </div>
  );
}
