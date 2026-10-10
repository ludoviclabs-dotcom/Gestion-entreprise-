import * as React from "react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"
import EmptyState from "@/components/empty/EmptyState"
import ErrorState from "@/components/empty/ErrorState"
import LoadingState from "@/components/empty/LoadingState"

export type DataTableState = "ready" | "loading" | "empty" | "error"

export interface DataTableProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** Contenu prêt : un <Table> et ses parties (components/ui/table). */
  children?: React.ReactNode
  /** Barre d'outils : recherche, filtres, SegmentedControl, actions. */
  toolbar?: React.ReactNode
  /** Pied : pagination, totaux, source. */
  footer?: React.ReactNode
  /** Défaut : "ready". */
  state?: DataTableState
  /** Remplace l'état de chargement par défaut. */
  loading?: React.ReactNode
  /** Remplace l'état vide par défaut. */
  empty?: React.ReactNode
  /** Remplace l'état d'erreur par défaut. */
  error?: React.ReactNode
  /** compact : lignes de 32 px (analyse dense) ; comfortable : lignes aérées. */
  density?: "compact" | "comfortable"
  /** En-tête figé pendant le défilement vertical (nécessite `maxHeight`). */
  stickyHeader?: boolean
  /** Hauteur max de la zone défilante (CSS : "24rem", 320…). */
  maxHeight?: string | number
  /** Nom accessible de la région. */
  label?: string
}

/**
 * Coque de tableau de données : conteneur à bordure froide, barre d'outils, zone
 * défilante (en-tête collant, densité), pied, et les trois états — chargement,
 * vide, erreur — au même emplacement pour éviter tout saut de mise en page.
 * C'est une COQUE : le tableau reste composé avec <Table>, <TableRow>…
 */
function DataTable({
  children,
  toolbar,
  footer,
  state = "ready",
  loading,
  empty,
  error,
  density = "comfortable",
  stickyHeader = false,
  maxHeight,
  label,
  className,
  style,
  ...props
}: DataTableProps) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      aria-busy={state === "loading" || undefined}
      data-slot="data-table"
      data-state={state}
      data-density={density}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
      style={style}
      {...props}
    >
      {toolbar ? (
        <div
          data-slot="data-table-toolbar"
          className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2"
        >
          {toolbar}
        </div>
      ) : null}

      <div
        data-slot="data-table-scroll"
        style={maxHeight !== undefined ? { maxHeight } : undefined}
        className={cn(
          "min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible",
          density === "compact"
            ? "[&_[data-slot=table-cell]]:py-1 [&_[data-slot=table-head]]:h-8"
            : "[&_[data-slot=table-cell]]:py-2.5",
          stickyHeader &&
            "[&_[data-slot=table-head]]:sticky [&_[data-slot=table-head]]:top-0 [&_[data-slot=table-head]]:z-[var(--z-raised)] [&_[data-slot=table-head]]:bg-card"
        )}
      >
        {state === "ready" ? (
          children
        ) : state === "loading" ? (
          (loading ?? <LoadingState variant="rows" label="Chargement des données…" />)
        ) : state === "empty" ? (
          (empty ?? (
            <EmptyState
              variant="inline"
              icon={Inbox}
              title="Aucune donnée"
              description="Aucun élément ne correspond à cette vue."
            />
          ))
        ) : (
          (error ?? (
            <ErrorState
              variant="inline"
              tone="vigilance"
              title="Données indisponibles"
              description="La source n'a pas répondu. Réessayez dans un instant."
            />
          ))
        )}
      </div>

      {footer ? (
        <div
          data-slot="data-table-footer"
          className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export { DataTable }
