import { notFound } from "next/navigation";
import CaseHeader from "@/components/cases/CaseHeader";
import WorkspaceTabs from "@/components/cases/WorkspaceTabs";
import PressNotice from "@/components/cases/PressNotice.client";
import { isPressConsultationFailed, isPressStale } from "@/lib/data/press-status";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { getScoreStatus, getSourceHealth } from "@/lib/data/case-quality";
import { reviewStateFromEvents } from "@/lib/audit/journal";
import { formatDateFr } from "@/lib/format-date";

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
  const sourceHealth = summaryEntry?.sourceHealth ?? getSourceHealth(detail.sources);
  const scoreStatus =
    summaryEntry?.scoreStatus ?? getScoreStatus(bundle.case.scores ?? {}, status);

  // Provenance honnête, dérivée des sources réellement consultées.
  const updatedLabel = summaryEntry?.updatedAt
    ? formatDateFr(summaryEntry.updatedAt)
    : null;

  // Axe de revue (P4) — projeté depuis le journal append-only.
  const reviewEvents = await getCasesRepository().listProofEvents(caseId);
  const reviewState = reviewStateFromEvents(reviewEvents);
  const reviewHighBand = (bundle.case.scores?.vigilance ?? 0) >= 67;

  // Presse (GDELT) collectée APRÈS la création : tant qu'elle n'est pas arrivée,
  // elle n'est pas « interrogée » — ni « aucun article », ni panne.
  const press = detail.press;
  const pressNotice =
    press && press.state !== "done"
      ? press.state === "pending" && !isPressStale(press)
        ? "pending"
        : "interrupted"
      : // Terminée, mais GDELT n'a jamais donné de réponse exploitable : non consultée.
        press && isPressConsultationFailed(detail.sources)
        ? "unreachable"
        : null;

  return (
    <div className="flex h-full flex-col">
      <CaseHeader
        caseId={caseId}
        title={bundle.case.title}
        rootSiren={bundle.case.rootSiren}
        status={status}
        reviewState={reviewState}
        reviewHighBand={reviewHighBand}
        counts={{
          entities: bundle.entities.length,
          links: bundle.edges.length,
          events: bundle.events.length,
        }}
        origin={sourceHealth.origin}
        sourceHealth={sourceHealth}
        scoreStatus={scoreStatus}
        updatedLabel={updatedLabel}
        scores={bundle.case.scores ?? {}}
        hasSignals={bundle.riskSignals.length > 0}
      />

      {pressNotice ? (
        <PressNotice state={pressNotice} requestedAt={press?.requestedAt} caseId={caseId} />
      ) : null}

      <WorkspaceTabs caseId={caseId} />

      <div className="min-h-0 flex-1">{props.children}</div>
    </div>
  );
}
