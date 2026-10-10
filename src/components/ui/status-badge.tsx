import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { TONE_STYLES, type Tone } from "@/lib/design/tone"

export interface StatusBadgeProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /** Teinte sémantique. Défaut : neutral. */
  tone?: Tone
  /** soft (fond teinté, défaut) · outline (contour seul) · solid (aplat). */
  appearance?: "soft" | "outline" | "solid"
  /** Point de statut. Par défaut affiché seulement s'il n'y a pas d'icône. */
  dot?: boolean
  icon?: LucideIcon
  children: React.ReactNode
}

/**
 * Statut lisible : un libellé TOUJOURS présent (la couleur ne porte jamais seule
 * l'information) + point ou icône. Construit sur <Badge> : les teintes viennent de
 * `lib/design/tone`, il n'y a pas de seconde source de style.
 */
function StatusBadge({
  tone = "neutral",
  appearance = "soft",
  dot,
  icon: Icon,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const showDot = dot ?? !Icon
  const styles = TONE_STYLES[tone]
  return (
    <Badge
      data-slot="status-badge"
      data-tone={tone}
      variant={appearance === "soft" ? tone : "outline"}
      className={cn(
        "gap-1.5 rounded-md",
        appearance === "outline" && styles.outline,
        appearance === "solid" && styles.solid,
        className
      )}
      {...props}
    >
      {showDot ? (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Badge>
  )
}

export { StatusBadge }
