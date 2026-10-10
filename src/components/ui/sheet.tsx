"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Tiroir (Radix Dialog) ancré sur un bord de l'écran. Même contrat d'accessibilité
 * qu'un dialogue : focus piégé, Échap, retour du focus. Pour un panneau latéral
 * complet (en-tête, corps défilant, pied, tailles) utiliser <SidePanel>, qui
 * compose ces primitives.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-[var(--z-overlay)] bg-overlay data-[state=closed]:motion-fade-out data-[state=open]:motion-fade-in",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  overlay = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  /** false : pas de voile (panneau non modal, voir <SidePanel modal={false}>). */
  overlay?: boolean
}) {
  return (
    <SheetPortal>
      {overlay ? <SheetOverlay /> : null}
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-[var(--z-overlay)] flex flex-col gap-4 bg-surface-3 text-foreground shadow-lg outline-none data-[state=closed]:motion-exit data-[state=open]:motion-enter",
          side === "right" &&
            "motion-from-right inset-y-0 right-0 h-full w-3/4 border-l border-border-strong sm:max-w-sm",
          side === "left" &&
            "motion-from-left inset-y-0 left-0 h-full w-3/4 border-r border-border-strong sm:max-w-sm",
          side === "top" &&
            "motion-from-top inset-x-0 top-0 h-auto border-b border-border-strong",
          side === "bottom" &&
            "motion-from-bottom inset-x-0 bottom-0 h-auto border-t border-border-strong",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground transition-ui hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Fermer</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-display font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
