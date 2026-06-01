import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { getCasesRepository } from "@/lib/data/cases-repository";
import EvidenceBadge from "@/components/graph/EvidenceBadge";
import EmptyState from "@/components/empty/EmptyState";

export default async function TimelineTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  const events = [...detail.bundle.events].sort((a, b) =>
    (b.occurredOn ?? "").localeCompare(a.occurredOn ?? ""),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Timeline juridique
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Événements officiels rattachés au dossier, du plus récent au plus ancien.
      </p>

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
          {events.map((ev, i) => (
            <li key={ev.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                {i < events.length - 1 && (
                  <span className="w-px flex-1 bg-border" />
                )}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{ev.title}</span>
                  <EvidenceBadge level={ev.evidenceLevel} />
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
          ))}
        </ol>
      )}
    </div>
  );
}
