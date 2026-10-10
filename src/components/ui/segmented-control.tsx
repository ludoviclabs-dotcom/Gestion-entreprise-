"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { ToggleGroup } from "radix-ui"

import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: LucideIcon
  disabled?: boolean
  /** Nom accessible si `label` n'est qu'une icône. */
  ariaLabel?: string
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedOption<T>[]
  /** Nom accessible du groupe — OBLIGATOIRE. */
  label: string
  size?: "sm" | "md"
  className?: string
}

/**
 * Choix exclusif parmi quelques valeurs (mode d'affichage, période, densité).
 * Sémantique « radio » (Radix ToggleGroup single) : flèches pour naviguer, une
 * valeur est toujours sélectionnée. Pour naviguer entre panneaux, utiliser <Tabs>.
 */
function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  options,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      data-slot="segmented-control"
      value={value}
      // Un groupe exclusif ne peut pas être « désélectionné » : Radix émet "" au
      // second clic sur l'élément actif, on l'ignore.
      onValueChange={(next) => {
        if (next) onValueChange(next as T)
      }}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-sunken p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-label={option.ariaLabel}
            data-slot="segmented-control-item"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius)-4px)] font-medium whitespace-nowrap text-muted-foreground transition-ui outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-surface-3 data-[state=on]:text-foreground data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-border-strong [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm"
            )}
          >
            {Icon ? <Icon aria-hidden /> : null}
            {option.label}
          </ToggleGroup.Item>
        )
      })}
    </ToggleGroup.Root>
  )
}

export { SegmentedControl }
