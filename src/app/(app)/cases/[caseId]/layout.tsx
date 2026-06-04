import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ScorePills from "@/components/cases/ScorePills";
import CaseStatusBadge from "@/components/cases/CaseStatusBadge";
import WorkspaceTabs from "@/components/cases/WorkspaceTabs";
import ExportMenu from "@/components/cases/ExportMenu.client";
import { getCasesRepository } from "@/lib/data/cases-repository";

export default async function CaseWorkspaceLayout(props: {
  children: React.ReactNode;
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  const { bundle } = detail;
  const summary = await getCasesRepository().listCases();
  const summaryEntry = summary.find((c) => c.id === caseId);
  const status = summaryEntry?.status ?? (bundle.case.scores ? "ready" : "draft");

  // Provenance honnête, dérivée des sources réellement consultées.
  const liveSources = detail.sources.filter((s) => !s.isFixture).length;
  const totalSources = detail.sources.length;
  const isLive = liveSources > 0;
  const updatedLabel = summaryEntry?.updatedAt
    ? new Intl.DateTimeFormat("fr-FR").format(new Date(summaryEntry.updatedAt))
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/cases"
            className="rounded-lg border border-border bg-surface p-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Retour aux dossiers"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                {bundle.case.title}
              </h1>
              <CaseStatusBadge status={status} />
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span>
                SIREN {bundle.case.rootSiren} · {bundle.entities.length} entités
                · {bundle.edges.length} liens
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5"
                title={
                  isLive
                    ? `${liveSources}/${totalSources} sources interrogées en temps réel`
                    : "Dossier de démonstration (données fictives)"
                }
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: isLive ? "#10b981" : "#f59e0b" }}
                />
                {isLive
                  ? `Données réelles · ${liveSources}/${totalSources} sources live`
                  : "Démonstration"}
                {updatedLabel ? ` · maj ${updatedLabel}` : ""}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScorePills scores={bundle.case.scores ?? {}} size="sm" />
          <ExportMenu caseId={caseId} />
        </div>
      </div>

      <div className="mt-3">
        <WorkspaceTabs caseId={caseId} />
      </div>

      <div className="min-h-0 flex-1">{props.children}</div>
    </div>
  );
}
