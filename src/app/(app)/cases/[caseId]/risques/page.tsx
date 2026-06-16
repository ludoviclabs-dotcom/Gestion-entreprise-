import { notFound } from "next/navigation";
import { getCasesRepository } from "@/lib/data/cases-repository";
import RisksList from "@/components/cases/RisksList.client";
import AiSynthesis from "@/components/cases/AiSynthesis.client";
import UboPanel from "@/components/cases/UboPanel";
import VigilanceBreakdown from "@/components/cases/VigilanceBreakdown";
import MitigatingFactors from "@/components/cases/MitigatingFactors";
import { AlgorithmExplainer } from "@/components/cases/AlgorithmExplainer";
import { InvestigationFiche } from "@/components/cases/InvestigationFiche";
import VigilanceRadar from "@/components/cases/VigilanceRadar";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { computeUbo } from "@/lib/graph/ubo";
import { computeConvergence, explainVigilance } from "@/lib/risk/engine";
import { computeVigilanceProfile } from "@/lib/risk/vigilance-profile";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";
import { DEFAULT_RULES } from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
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
  // Faisceau d'indices : un signal isolé n'est jamais une alerte (§7.3).
  const faisceau = computeConvergence(signals, DEFAULT_THRESHOLDS.convergence.k);
  // Garde-fou faux positifs : éléments rassurants à afficher avec les signaux.
  const mitigating = computeMitigatingFactors(detail.bundle);
  // Fiches d'investigation par règle/typologie réellement présente (M11).
  const ruleLabels = new Map(DEFAULT_RULES.map((r) => [r.id, r.label]));
  const presentRules = [...new Set(signals.map((s) => s.ruleId))];

  // Profil de vigilance (V7) — 3 axes réellement calculables, échelle 0-100.
  const radarAxes = computeVigilanceProfile(detail.bundle, signals);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Signaux de vigilance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Indicateurs de <GlossaryTerm id="complexite">complexité</GlossaryTerm> et
        de <GlossaryTerm id="vigilance">vigilance</GlossaryTerm>. Ce sont des
        signaux d&apos;analyse, jamais des accusations.
      </p>
      {signals.length > 0 ? (
        <div className="mt-6">
          <VigilanceBreakdown explanation={vigilance} faisceau={faisceau} />
        </div>
      ) : null}
      {signals.length > 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
            Profil de vigilance
          </h3>
          <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
            <VigilanceRadar axes={radarAxes} />
            <div className="flex-1 space-y-2 text-xs text-muted-foreground">
              <p>
                {radarAxes
                  .map((a) => `${a.label} ${Math.round(a.value)}`)
                  .join(" · ")}{" "}
                (sur 100).
              </p>
              <p>
                Indicateur d&apos;orientation calculé depuis les signaux et la
                structure du dossier — à interpréter, jamais un verdict, la
                décision reste humaine. Les axes substance / activité / flux ne
                sont pas évalués faute de données.
              </p>
            </div>
          </div>
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
          <AlgorithmExplainer id="detention-indirecte" />
          <AlgorithmExplainer id="ecart-ubo" />
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
      {mitigating.length > 0 ? (
        <div className="mt-6">
          <MitigatingFactors factors={mitigating} />
        </div>
      ) : null}
      {presentRules.length > 0 ? (
        <div className="mt-6 space-y-2">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
            Fiches d&apos;investigation
          </h3>
          <p className="text-xs text-muted-foreground">
            Pistes de vérification par type de signal — des questions à lever,
            jamais des conclusions.
          </p>
          {presentRules.map((id) => (
            <InvestigationFiche key={id} ruleId={id} label={ruleLabels.get(id)} />
          ))}
        </div>
      ) : null}
      {signals.length > 0 ? (
        <div className="mt-4">
          <AlgorithmExplainer id="chemin-sanctions" />
        </div>
      ) : null}
    </div>
  );
}
