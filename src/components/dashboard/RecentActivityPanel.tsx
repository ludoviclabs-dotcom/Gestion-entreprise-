import Link from "next/link";
import { History } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import EmptyState from "@/components/empty/EmptyState";
import CaseStatusBadge from "@/components/cases/CaseStatusBadge";
import type { CaseSummary } from "@/lib/data/types";
import { ACTIVITY_WINDOW_DAYS } from "@/lib/dashboard/portfolio";
import { formatDateTimeFr, formatRelativeFr } from "@/lib/format-date";

/**
 * Activité récente : dernières mises à jour des dossiers (date relative, date
 * exacte au survol et pour les lecteurs d'écran via `<time>`). Composant serveur :
 * `now` est fixé au rendu, aucune divergence d'hydratation.
 */
export default function RecentActivityPanel({
  items,
  updatedInWindow,
  now,
}: {
  items: CaseSummary[];
  updatedInWindow: number;
  now: Date;
}) {
  return (
    <Panel role="region" aria-labelledby="recent-activity-title" className="h-full">
      <PanelHeader className="items-start">
        <div className="min-w-0">
          <PanelTitle as="h2" id="recent-activity-title">
            Activité récente
          </PanelTitle>
          <PanelDescription>Dernières mises à jour des dossiers actifs.</PanelDescription>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {updatedInWindow} mis à jour · {ACTIVITY_WINDOW_DAYS} j
        </span>
      </PanelHeader>
      <PanelBody className="p-2">
        {items.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={History}
            title="Aucune activité"
            description="Les mises à jour de dossiers apparaîtront ici."
          />
        ) : (
          <ol className="space-y-0.5">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}/graphe`}
                  className="flex flex-col gap-1 rounded-md border border-transparent px-2 py-2 text-sm transition-ui outline-none hover:border-border hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-2 sm:flex-row sm:items-center sm:gap-3 sm:px-3"
                >
                  <time
                    dateTime={c.updatedAt}
                    title={formatDateTimeFr(c.updatedAt)}
                    className="shrink-0 text-xs text-subtle tabular-nums sm:w-28"
                  >
                    {formatRelativeFr(c.updatedAt, now)}
                  </time>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 truncate text-foreground">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {c.counts.entities} {c.counts.entities > 1 ? "entités" : "entité"}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <CaseStatusBadge status={c.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </PanelBody>
    </Panel>
  );
}
