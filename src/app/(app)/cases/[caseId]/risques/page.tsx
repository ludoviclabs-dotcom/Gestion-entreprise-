import { notFound } from "next/navigation";
import { getCasesRepository } from "@/lib/data/cases-repository";
import RisksList from "@/components/cases/RisksList.client";
import AiSynthesis from "@/components/cases/AiSynthesis.client";
import UboPanel from "@/components/cases/UboPanel";
import VigilanceBreakdown from "@/components/cases/VigilanceBreakdown";
import { computeUbo } from "@/lib/graph/ubo";
import { explainVigilance } from "@/lib/risk/engine";
import { isDemoMode, isInpiUboExposed } from "@/lib/env";

export default async function RisquesTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const repository = getCasesRepository();
  const detail = await repository.getCase(caseId);
  if (!detail) notFound();
  // Historique horodaté des écarts UBO (journal de preuve, agrégats CJUE).
  const ecartHistory = (await repository.listProofEvents(caseId)).filter(
    (e) => e.kind === "ecart_ubo_detecte",
  );
  // Provenance résumée pour le briefing de synthèse (endpoint + empreinte —
  // jamais le payload brut côté client).
  const briefingSources = (await repository.getSourceRecords(caseId)).map(
    (r) => ({
      source: r.source,
      endpoint: r.endpoint,
      payloadHash: r.payloadHash,
    }),
  );

  const signals = detail.bundle.riskSignals;

  // Bénéficiaires effectifs recalculés depuis le capital (pur, sans clé).
  const ubo = computeUbo(detail.bundle);
  // Garde-fou CJUE 2022 : nominatif si données de démonstration anonymisées
  // (toutes les sources sont des fixtures), en mode démo, ou si UBO exposés ;
  // sinon (vraies personnes en live) → anonymisé.
  const allFixtureSources =
    detail.sources.length > 0 && detail.sources.every((s) => s.isFixture);
  const showUboNames = allFixtureSources || isDemoMode() || isInpiUboExposed();
  const ecartSignal = signals.find((s) => s.ruleId === "ECART_UBO_DECLARE");
  const vigilance = explainVigilance(signals);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Signaux de vigilance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Indicateurs de complexité et de vigilance. Ce sont des signaux
        d&apos;analyse, jamais des accusations.
      </p>
      {signals.length > 0 ? (
        <div className="mt-6">
          <VigilanceBreakdown explanation={vigilance} />
        </div>
      ) : null}
      {ubo.length > 0 ? (
        <div className="mt-6">
          <UboPanel
            owners={ubo}
            showNames={showUboNames}
            ecartExplanation={ecartSignal?.explanation}
            ecartHistory={ecartHistory}
          />
        </div>
      ) : null}
      <div className="mt-6">
        <AiSynthesis bundle={detail.bundle} sources={briefingSources} />
      </div>
      <div className="mt-6">
        {signals.length === 0 ? (
          <p className="rounded-xl border border-emerald/30 bg-emerald/10 p-4 text-sm text-emerald">
            Aucun signal de vigilance détecté pour ce dossier.
          </p>
        ) : (
          <RisksList signals={signals} />
        )}
      </div>
    </div>
  );
}
