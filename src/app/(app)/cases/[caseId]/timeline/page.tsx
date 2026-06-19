import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { getCasesRepository } from "@/lib/data/cases-repository";
import EvidenceBadge from "@/components/graph/EvidenceBadge";
import EmptyState from "@/components/empty/EmptyState";
import GraphEvolution from "@/components/cases/GraphEvolution";
import { diffBundles } from "@/lib/graph/diff";
import { SEVERITY_COLORS, maxSeverityBySubject } from "@/lib/graph/graph-types";
import type { Severity } from "@/lib/graph/graph-types";

/** Badge par type d'événement presse (GDELT) — distingue la tonalité défavorable. */
function mediaBadge(
  kind: string,
): { label: string; className: string } | null {
  if (kind === "couverture_media_defavorable")
    return {
      label: "Presse — défavorable",
      className: "border border-amber/40 bg-amber/10 text-amber",
    };
  if (kind === "couverture_media")
    return {
      label: "Presse",
      className: "border border-border bg-surface text-muted-foreground",
    };
  return null;
}

export default async function TimelineTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  const { bundle } = detail;
  const events = [...bundle.events].sort((a, b) =>
    (b.occurredOn ?? "").localeCompare(a.occurredOn ?? ""),
  );

  // Sévérité maximale par entité signalée → met en avant les événements liés à
  // un signal de vigilance (V10), sans jamais qualifier l'événement lui-même.
  const sevByEntity = maxSeverityBySubject(bundle.riskSignals);
  const materialSev = (entityId: string): Severity | null => {
    const sev = sevByEntity.get(entityId);
    return sev === "medium" || sev === "high" ? sev : null;
  };

  // Diff d'évolution T0 → T1 si un état antérieur est disponible.
  const previous = bundle.previous;
  const diff = previous
    ? diffBundles(previous, { entities: bundle.entities, edges: bundle.edges })
    : null;
  const evolutionLabels: Record<string, string> = Object.fromEntries(
    [...(previous?.entities ?? []), ...bundle.entities].map((e) => [e.id, e.label]),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Timeline juridique
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Événements officiels rattachés au dossier, du plus récent au plus ancien.
      </p>

      {diff && previous ? (
        <div className="mt-6">
          <GraphEvolution
            diff={diff}
            fromLabel={previous.label}
            labels={evolutionLabels}
          />
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Clock}
            title="Aucun événement juridique"
            description="Aucune annonce BODACC n'a été détectée pour ce dossier. Une fois les connecteurs live activés (clé Sirene + BODACC), les événements remonteront automatiquement."
          />
        </div>
      ) : (
        <ol className="mt-6 space-y-0">
          {events.map((ev, i) => {
            const sev = materialSev(ev.entityId);
            const media = mediaBadge(ev.kind);
            return (
            <li key={ev.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className="mt-1 h-2.5 w-2.5 rounded-full bg-primary"
                  style={sev ? { backgroundColor: SEVERITY_COLORS[sev] } : undefined}
                />
                {i < events.length - 1 && (
                  <span className="w-px flex-1 bg-border" />
                )}
              </div>
              <div className="pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{ev.title}</span>
                  <EvidenceBadge level={ev.evidenceLevel} />
                  {media ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${media.className}`}
                    >
                      {media.label}
                    </span>
                  ) : null}
                  {sev ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: `${SEVERITY_COLORS[sev]}22`,
                        color: SEVERITY_COLORS[sev],
                      }}
                    >
                      Lié à un signal de vigilance
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ev.occurredOn
                    ? new Date(ev.occurredOn).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "Date inconnue"}
                  {ev.source ? ` · ${ev.source}` : ""}
                </p>
              </div>
            </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
