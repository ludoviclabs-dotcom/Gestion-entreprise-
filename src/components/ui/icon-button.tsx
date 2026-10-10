"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIZE_MAP = {
  xs: "icon-xs",
  sm: "icon-sm",
  md: "icon",
  lg: "icon-lg",
} as const

export interface IconButtonProps
  extends Omit<
    React.ComponentProps<typeof Button>,
    "children" | "size" | "aria-label" | "asChild"
  > {
  /** Nom accessible — OBLIGATOIRE : un bouton icône n'a pas de texte visible. */
  label: string
  icon: LucideIcon
  size?: keyof typeof SIZE_MAP
  /** Affiche `label` dans une infobulle (survol + focus). Défaut : true. */
  tooltip?: boolean
  /** État bascule (aria-pressed). */
  pressed?: boolean
}

/**
 * Bouton icône : étend <Button> (aucune seconde source de style) en imposant un
 * nom accessible et, par défaut, une infobulle. Pas de mouvement au survol.
 */
function IconButton({
  label,
  icon: Icon,
  size = "md",
  variant = "ghost",
  tooltip = true,
  pressed,
  ...props
}: IconButtonProps) {
  const button = (
    <Button
      type="button"
      variant={variant}
      size={SIZE_MAP[size]}
      aria-label={label}
      aria-pressed={pressed}
      {...props}
    >
      <Icon aria-hidden />
    </Button>
  )

  if (!tooltip) return button

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { IconButton }
