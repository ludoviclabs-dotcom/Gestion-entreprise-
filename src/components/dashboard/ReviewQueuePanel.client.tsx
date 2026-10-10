"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FilePlus2, ListChecks, SearchX } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import EmptyState from "@/components/empty/EmptyState";
import CaseStatusBadge from "@/components/cases/CaseStatusBadge";
import { OriginBadge } from "@/components/cases/CaseQualityBadges";
import {
  reviewTarget,
  type ReviewItem,
  type ReviewReasonKind,
} from "@/lib/dashboard/portfolio";

export type ReviewFilter = "all" | "signals" | "sources" | "scores";
type Filter = ReviewFilter;

const FILTER_KINDS: Record<Exclude<Filter, "all">, ReviewReasonKind[]> = {
  signals: ["signals_high", "vigilance_high"],
  sources: ["sources_failed"],
  scores: ["score_incomplete"],
};

const MAX_ROWS = 6;

/**
 * Cible d'une ligne : sous un filtre, l'onglet de la raison FILTRÉE (un dossier
 * à signaux élevés ET sources en échec mène aux sources sous « Sources ») ;
 * sans filtre, celui de la raison principale.
 */
export function targetFor(item: ReviewItem, filter: Filter): { href: string; actionLabel: string } {
  if (filter === "all") return { href: item.href, actionLabel: item.actionLabel };
  const reason = item.reasons.find((r) => FILTER_KINDS[filter].includes(r.kind));
  return reason ? reviewTarget(item.case.id, reason.kind) : { href: item.href, actionLabel: item.actionLabel };
}

function matches(item: ReviewItem, filter: Filter): boolean {
  if (filter === "all") return true;
  const kinds = FILTER_KINDS[filter];
  return item.reasons.some((r) => kinds.includes(r.kind));
}

/**
 * « Dossiers à revoir » : la file de traitement (buildReviewQueue). Chaque ligne
 * dit POURQUOI le dossier remonte (raisons écrites, teinte en appui) et mène à
 * l'onglet où agir. Le filtre ne masque rien d'autre que la liste.
 */
export default function ReviewQueuePanel({
  queue,
  totalCases,
}: {
  queue: ReviewItem[];
  totalCases: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (f: Filter) => queue.filter((item) => matches(item, f)).length;
  const visible = queue.filter((item) => matches(item, filter));

  return (
    <Panel role="region" aria-labelledby="review-queue-title" className="h-full">
      <PanelHeader className="flex-wrap items-start">
        <div className="min-w-0">
          <PanelTitle as="h2" id="review-queue-title" className="flex items-center gap-2">
            Dossiers à revoir
            {queue.length > 0 ? (
              <StatusBadge tone={queue[0].reasons[0].tone}>{queue.length}</StatusBadge>
            ) : null}
          </PanelTitle>
          <PanelDescription>
            Ordre de traitement : signaux élevés, vigilance, sources en échec, scoring incomplet.
          </PanelDescription>
        </div>
        {queue.length > 0 ? (
          <SegmentedControl<Filter>
            label="Filtrer les dossiers à revoir"
            size="sm"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: `Tout · ${queue.length}` },
              { value: "signals", label: `Signaux · ${count("signals")}`, disabled: count("signals") === 0 },
              { value: "sources", label: `Sources · ${count("sources")}`, disabled: count("sources") === 0 },
              { value: "scores", label: `Scores · ${count("scores")}`, disabled: count("scores") === 0 },
            ]}
          />
        ) : null}
      </PanelHeader>

      <PanelBody className="p-2">
        {totalCases === 0 ? (
          <EmptyState
            variant="inline"
            icon={FilePlus2}
            title="Aucun dossier pour l'instant"
            description="Créez un dossier à partir d'un nom de société ou d'un SIREN."
            cta={{ label: "Nouveau dossier", href: "/cases/new" }}
          />
        ) : queue.length === 0 ? (
          <EmptyState
            variant="inline"
            tone="good"
            icon={ListChecks}
            title="Aucun dossier à revoir"
            description="Aucun dossier actif ne porte de signal élevé, de source en échec ni de score incomplet."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={SearchX}
            title="Aucun dossier pour ce filtre"
          />
        ) : (
          <ol key={filter} className="motion-fade-in space-y-0.5" aria-label="Dossiers à revoir, par ordre de traitement">
            {visible.slice(0, MAX_ROWS).map((item, index) => {
              const target = targetFor(item, filter);
              return (
              <li key={item.case.id}>
                <Link
                  href={target.href}
                  className="group flex items-start gap-3 rounded-md border border-transparent px-2 py-2.5 transition-ui outline-none hover:border-border hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-2 sm:px-3"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 w-4 shrink-0 text-right text-xs text-subtle tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {item.case.title}
                      </span>
                      <CaseStatusBadge status={item.case.status} />
                      {item.case.origin === "fixture" ? (
                        <OriginBadge origin="fixture" compact />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                      SIREN {item.case.rootSiren} · {item.case.counts.entities}{" "}
                      {item.case.counts.entities > 1 ? "entités" : "entité"}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span className="sr-only">Raisons :</span>
                      {item.reasons.map((reason) => (
                        <StatusBadge key={reason.kind} tone={reason.tone}>
                          {reason.label}
                        </StatusBadge>
                      ))}
                    </span>
                  </span>
                  <span className="mt-0.5 hidden shrink-0 items-center gap-1 text-xs font-medium text-primary sm:inline-flex">
                    {target.actionLabel}
                    <ArrowRight aria-hidden className="size-3.5" />
                  </span>
                </Link>
              </li>
              );
            })}
          </ol>
        )}
      </PanelBody>

      {queue.length > 0 ? (
        <PanelFooter>
          <span className="tabular-nums">
            {Math.min(visible.length, MAX_ROWS)} affiché{Math.min(visible.length, MAX_ROWS) > 1 ? "s" : ""} sur{" "}
            {visible.length}
          </span>
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 rounded-sm font-medium text-primary transition-ui hover:text-primary-hover"
          >
            Tous les dossiers
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </PanelFooter>
      ) : null}
    </Panel>
  );
}
