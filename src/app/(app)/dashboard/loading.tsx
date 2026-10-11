import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";

/**
 * Chargement du tableau de bord : même gabarit que la page (en-tête, bandeau,
 * 4 indicateurs, 2 rangées de panneaux) pour qu'aucun bloc ne saute à l'arrivée
 * des données. Annoncé une seule fois aux lecteurs d'écran.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto max-w-[var(--layout-page-max)] space-y-6 px-4 py-6 sm:px-6 lg:py-8"
    >
      <span className="sr-only">Chargement du tableau de bord…</span>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-[4.5rem] w-full rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>

      {[0, 1].map((row) => (
        <div key={row} className="grid gap-6 lg:grid-cols-12">
          <Panel className="lg:col-span-7 xl:col-span-8">
            <PanelHeader>
              <Skeleton className="h-4 w-40" />
            </PanelHeader>
            <PanelBody className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </PanelBody>
          </Panel>
          <Panel className="lg:col-span-5 xl:col-span-4">
            <PanelHeader>
              <Skeleton className="h-4 w-32" />
            </PanelHeader>
            <PanelBody className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </PanelBody>
          </Panel>
        </div>
      ))}
    </div>
  );
}
