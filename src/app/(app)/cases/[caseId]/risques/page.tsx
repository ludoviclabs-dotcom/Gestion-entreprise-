import { notFound } from "next/navigation";
import { getCasesRepository } from "@/lib/data/cases-repository";
import RisksList from "@/components/cases/RisksList.client";
import AiSynthesis from "@/components/cases/AiSynthesis.client";

export default async function RisquesTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  const signals = detail.bundle.riskSignals;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Signaux de vigilance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Indicateurs de complexité et de vigilance. Ce sont des signaux
        d&apos;analyse, jamais des accusations.
      </p>
      <div className="mt-6">
        <AiSynthesis caseId={caseId} />
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
