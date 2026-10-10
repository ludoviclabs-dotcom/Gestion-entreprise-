import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * Carte / panneau du design system.
 *   default — carte roomy shadcn (gap-6 py-6), pour les contenus éditoriaux ;
 *   panel   — conteneur dense : en-tête / corps / pied séparés par des filets
 *             (voir Panel*) ; c'est le défaut des écrans d'analyse ;
 *   raised  — surface 2 + élévation moyenne (contenu mis en avant) ;
 *   sunken  — puits (zones en creux, code, aperçus).
 * `interactive` : la carte est cliquable — bordure + halo au survol, jamais de
 * déplacement.
 */
const cardVariants = cva(
  "flex flex-col rounded-lg border text-card-foreground",
  {
    variants: {
      variant: {
        default: "gap-6 bg-card py-6 shadow-sm",
        panel: "gap-0 overflow-hidden bg-card py-0 shadow-sm",
        raised: "gap-6 border-border-strong bg-surface-2 py-6 shadow-md",
        sunken: "gap-6 border-border-subtle bg-sunken py-6",
      },
      interactive: {
        true: "cursor-pointer transition-ui hover:border-primary/40 hover:shadow-glow focus-visible:border-ring",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  }
)

function Card({
  className,
  variant,
  interactive,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-variant={variant ?? "default"}
      className={cn(cardVariants({ variant, interactive }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

/* ── Panel : composition dense de Card (variant="panel") ── */

function Panel({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "variant">) {
  return <Card variant="panel" data-slot="panel" className={className} {...props} />
}

function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-header"
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-4 py-3",
        className
      )}
      {...props}
    />
  )
}

function PanelTitle({
  as: Tag = "h3",
  className,
  ...props
}: React.ComponentProps<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Tag
      data-slot="panel-title"
      className={cn("font-display text-sm leading-none font-semibold", className)}
      {...props}
    />
  )
}

function PanelDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="panel-description"
      className={cn("mt-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function PanelBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="panel-body" className={cn("p-4", className)} {...props} />
}

function PanelFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="panel-footer"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border bg-surface-2/40 px-4 py-2.5 text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  Panel,
  PanelHeader,
  PanelTitle,
  PanelDescription,
  PanelBody,
  PanelFooter,
}
