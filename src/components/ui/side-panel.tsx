"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const SIZE_CLASSES = {
  sm: "sm:max-w-[20rem]",
  md: "sm:max-w-[var(--layout-panel-width)]",
  lg: "sm:max-w-[30rem]",
  xl: "sm:max-w-[40rem]",
} as const

export type SidePanelSize = keyof typeof SIZE_CLASSES

export interface SidePanelProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Élément déclencheur (rendu tel quel via `asChild`). */
  trigger?: React.ReactNode
  /** Titre — OBLIGATOIRE : c'est le nom accessible du panneau. */
  title: React.ReactNode
  description?: React.ReactNode
  side?: "left" | "right"
  size?: SidePanelSize
  /**
   * true (défaut) : modal — voile, focus piégé, le reste de la page est inerte.
   * false : panneau d'inspection non modal — pas de voile, le contexte reste
   * utilisable (ex. fiche d'un nœud du graphe) ; Échap et le bouton ferment.
   */
  modal?: boolean
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Panneau latéral / tiroir : en-tête (titre, description, fermer), corps défilant,
 * pied facultatif. Compose <Sheet> (Radix Dialog) : focus piégé en mode modal,
 * fermeture par Échap, retour du focus au déclencheur. Entrée = translation
 * légère + opacité + ressort doux (tokens motion), sortie plus courte.
 */
function SidePanel({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  side = "right",
  size = "md",
  modal = true,
  footer,
  className,
  children,
}: SidePanelProps) {
  return (
    <Sheet
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      modal={modal}
    >
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side={side}
        overlay={modal}
        showCloseButton={false}
        // Sans description fournie, on le déclare explicitement (sinon Radix
        // avertit en développement).
        {...(description ? {} : { "aria-describedby": undefined })}
        onInteractOutside={modal ? undefined : (event) => event.preventDefault()}
        data-slot="side-panel"
        className={cn("w-full gap-0 p-0", SIZE_CLASSES[size], className)}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <SheetTitle className="text-base leading-tight">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="mt-1 text-xs">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          <SheetClose asChild>
            <IconButton
              label="Fermer le panneau"
              icon={XIcon}
              size="sm"
              tooltip={false}
            />
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        {footer ? (
          <div className="border-t border-border bg-surface-2/40 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export { SidePanel }
