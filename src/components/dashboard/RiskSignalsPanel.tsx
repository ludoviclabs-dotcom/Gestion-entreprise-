import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import EmptyState from "@/components/empty/EmptyState";
import { SEVERITY_TONE } from "@/lib/design/domain-tones";
import { TONE_STYLES } from "@/lib/design/tone";
import { SEVERITY_LABELS, type Severity } from "@/lib/graph/graph-types";
import type { SignalsOverview } from "@/lib/dashboard/portfolio";
import { cn } from "@/lib/utils";

const SEVERITIES: Severity[] = ["high", "medium", "low", "info"];
const MAX_CASES = 5;

function severityCount(n: number, s: Severity): string {
  const label = SEVERITY_LABELS[s].toLowerCase();
  return `${n} ${label}${n > 1 && s !== "info" ? "s" : ""}`;
}

/**
 * Signaux de sévérité élevée : combien, où (dossiers), de quelle nature
 * (familles de règles, quand la répartition est connue). Chaque teinte est
 * doublée d'un libellé ; les barres ne font qu'appuyer des nombres écrits.
 * Vocabulaire non accusatoire : un signal est à instruire, jamais une conclusion.
 */
export default function RiskSignalsPanel({
  signals,
  totalCases,
}: {
  signals: SignalsOverview;
  totalCases: number;
}) {
  const maxFamily = Math.max(1, ...signals.families.map((f) => f.total));

  return (
    <Panel role="region" aria-labelledby="risk-signals-title" className="h-full">
      <PanelHeader className="items-start">
        <div className="min-w-0">
          <PanelTitle as="h2" id="risk-signals-title">
            Signaux de sévérité élevée
          </PanelTitle>
          <PanelDescription>À instruire en priorité — jamais une qualification.</PanelDescription>
        </div>
        <StatusBadge tone={signals.totalHigh > 0 ? "critical" : "success"}>
          {signals.totalHigh > 0 ? `${signals.totalHigh} élevé${signals.totalHigh > 1 ? "s" : ""}` : "Aucun"}
        </StatusBadge>
      </PanelHeader>

      <PanelBody className="space-y-5">
        {signals.totalHigh === 0 ? (
          <EmptyState
            variant="inline"
            tone="good"
            icon={ShieldCheck}
            title="Aucun signal de sévérité élevée"
            description={`Sur ${totalCases} dossier${totalCases > 1 ? "s" : ""} actif${totalCases > 1 ? "s" : ""}. L'absence de signal ne remplace pas la lecture des sources de chaque dossier.`}
            className="py-6"
          />
        ) : (
          <div>
            <h3 className="text-eyebrow mb-2">Par dossier</h3>
            <ul className="-mx-2 space-y-0.5">
              {signals.cases.slice(0, MAX_CASES).map(({ case: c, high }) => (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}/risques`}
                    className="flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm transition-ui outline-none hover:border-border hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-2"
                  >
                    <span className="min-w-0 truncate text-foreground">{c.title}</span>
                    <StatusBadge tone="critical" className="shrink-0">
                      {severityCount(high, "high")}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
            {signals.cases.length > MAX_CASES ? (
              <p className="mt-2 text-xs text-muted-foreground">
                + {signals.cases.length - MAX_CASES} autre(s) dossier(s) concerné(s).
              </p>
            ) : null}
          </div>
        )}

        {signals.families.length > 0 ? (
          <div>
            <h3 className="text-eyebrow">Par famille de règles</h3>
            <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
              Tous niveaux de sévérité, sur {signals.familiesCoverage} dossier
              {signals.familiesCoverage > 1 ? "s" : ""} détaillé
              {signals.familiesCoverage > 1 ? "s" : ""}
              {signals.familiesCoverage < totalCases ? ` (sur ${totalCases})` : ""}.
            </p>
            <ul className="space-y-3">
              {signals.families.map((row) => (
                <li key={row.family}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">{row.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {SEVERITIES.filter((s) => row.counts[s] > 0)
                        .map((s) => severityCount(row.counts[s], s))
                        .join(" · ")}
                    </span>
                  </div>
                  <div
                    aria-hidden
                    className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-3"
                    style={{ width: `${Math.max(8, (row.total / maxFamily) * 100)}%` }}
                  >
                    {SEVERITIES.map((s) =>
                      row.counts[s] > 0 ? (
                        <span
                          key={s}
                          className={cn("h-full", TONE_STYLES[SEVERITY_TONE[s]].dot)}
                          style={{ width: `${(row.counts[s] / row.total) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PanelBody>

      <PanelFooter>
        <span>Répartition détaillée famille × sévérité</span>
        <Link
          href="/cases"
          className="inline-flex items-center gap-1 rounded-sm font-medium text-primary transition-ui hover:text-primary-hover"
        >
          Dossiers
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </PanelFooter>
    </Panel>
  );
}
