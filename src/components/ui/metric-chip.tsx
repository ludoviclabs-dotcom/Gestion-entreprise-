import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_STYLES, type Tone } from "@/lib/design/tone"

export interface MetricChipProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  label: string
  /** Valeur affichée. « — » est utilisé par l'appelant quand elle est absente. */
  value: React.ReactNode
  /** Suffixe de la valeur, ex. « /100 ». */
  unit?: string
  /** Teinte de la VALEUR (le libellé reste secondaire). Défaut : texte principal. */
  tone?: Tone
  size?: "sm" | "md"
  icon?: LucideIcon
}

/**
 * Métrique compacte « libellé · valeur » (scores, compteurs). Chiffres en
 * `tabular-nums` pour l'alignement ; la teinte ne remplace jamais le libellé.
 */
function MetricChip({
  label,
  value,
  unit,
  tone,
  size = "md",
  icon: Icon,
  className,
  ...props
}: MetricChipProps) {
  return (
    <span
      data-slot="metric-chip"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-surface",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden className="size-3.5 text-subtle" /> : null}
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          tone ? TONE_STYLES[tone].text : "text-foreground"
        )}
      >
        {value}
        {unit ? (
          <span className="ml-0.5 text-micro font-normal text-subtle">{unit}</span>
        ) : null}
      </span>
    </span>
  )
}

export { MetricChip }
