import * as React from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { cardVariants } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { TONE_STYLES, type Tone } from "@/lib/design/tone"

export interface StatCardDelta {
  /** Valeur de la variation, déjà formatée (« +3 », « −12 % »). */
  value: string
  direction: "up" | "down" | "flat"
  /** Référence de la variation — OBLIGATOIRE (« vs 7 jours précédents »). */
  label: string
  /** Teinte : neutre par défaut (une hausse n'est ni bonne ni mauvaise en soi). */
  tone?: Tone
}

export interface StatCardProps {
  /** Libellé de l'indicateur. */
  label: string
  /** Valeur principale (« — » si absente : jamais un 0 trompeur). */
  value: React.ReactNode
  /** Unité ou base, ex. « /100 ». */
  unit?: string
  icon?: LucideIcon
  /** Lecture qualitative : teinte + libellé texte (la couleur ne porte jamais seule l'information). */
  status?: { tone: Tone; label: string }
  /** Variation, uniquement si une période de référence existe dans les données. */
  delta?: StatCardDelta
  /** Périmètre, période ou composition de la valeur. */
  context?: React.ReactNode
  /** La carte devient un lien (bordure + halo au survol, anneau au focus). */
  href?: string
  className?: string
}

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const

/**
 * Indicateur clé : libellé · valeur · lecture qualitative · variation · contexte.
 * Un chiffre n'est jamais affiché sans son libellé ni son périmètre. Structure
 * `dl` (dt = libellé, dd = valeur et contexte) : lu « Signaux élevés, 4 ».
 */
function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  status,
  delta,
  context,
  href,
  className,
}: StatCardProps) {
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null
  const body = (
    <dl className="flex min-w-0 flex-col">
      <dt className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
        <span className="min-w-0">{label}</span>
        {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-subtle" /> : null}
      </dt>
      <dd className="mt-2 flex items-baseline gap-1 font-display text-3xl font-bold text-foreground tabular-nums">
        {value}
        {unit ? <span className="text-sm font-medium text-subtle">{unit}</span> : null}
      </dd>
      {status || delta ? (
        <dd className="mt-2 flex flex-wrap items-center gap-2">
          {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
          {delta && DeltaIcon ? (
            <span
              data-slot="stat-delta"
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
                TONE_STYLES[delta.tone ?? "neutral"].text
              )}
            >
              <DeltaIcon aria-hidden className="size-3.5" />
              {delta.value}
              <span className="font-normal text-muted-foreground">{delta.label}</span>
            </span>
          ) : null}
        </dd>
      ) : null}
      {context ? <dd className="mt-2 text-xs text-muted-foreground">{context}</dd> : null}
    </dl>
  )

  const classes = cn(
    cardVariants({ variant: "panel", interactive: Boolean(href) }),
    "p-4",
    className
  )

  return href ? (
    <Link href={href} data-slot="stat-card" className={classes}>
      {body}
    </Link>
  ) : (
    <div data-slot="stat-card" className={classes}>
      {body}
    </div>
  )
}

export { StatCard }
