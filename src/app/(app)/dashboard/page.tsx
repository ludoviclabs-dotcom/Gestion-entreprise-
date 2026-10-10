import Link from "next/link";
import { BadgeCheck, Building2, FolderOpen, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { StatCard } from "@/components/ui/stat-card";
import PageHeader from "@/components/shell/PageHeader";
import NextActionBanner from "@/components/dashboard/NextActionBanner";
import ReviewQueuePanel from "@/components/dashboard/ReviewQueuePanel.client";
import RiskSignalsPanel from "@/components/dashboard/RiskSignalsPanel";
import RecentActivityPanel from "@/components/dashboard/RecentActivityPanel";
import QuickAccessPanel from "@/components/dashboard/QuickAccessPanel";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { curateCaseSummaries } from "@/lib/data/case-curation";
import {
  buildReviewQueue,
  computePortfolioKpis,
  nextAction,
  proofQualityStatus,
  recentActivity,
  summarizeSignals,
} from "@/lib/dashboard/portfolio";
import { formatDateTimeFr } from "@/lib/format-date";

export const metadata = { title: "Tableau de bord — KYB Graph" };

const fr = (n: number) => n.toLocaleString("fr-FR");
const s = (n: number) => (n > 1 ? "s" : "");

/**
 * Tableau de bord : répondre en moins de 5 secondes à
 *   1. quels dossiers exigent une revue  → « Dossiers à revoir » ;
 *   2. quels signaux sont critiques      → « Signaux de sévérité élevée » ;
 *   3. quelle est la prochaine action    → bandeau « Prochaine action » ;
 *   4. où trouver le reste               → « Accès rapides » (+ sidebar).
 * Toutes les valeurs dérivent de `listCases` (une seule lecture, calculs
 * historiques conservés — lib/dashboard/portfolio).
 */
export default async function DashboardPage() {
  const allCases = await getCasesRepository().listCases();
  const curated = curateCaseSummaries(allCases);
  const cases = curated.visible;
  const now = new Date();

  const kpis = computePortfolioKpis(cases);
  const queue = buildReviewQueue(cases);
  const signals = summarizeSignals(cases);
  const activity = recentActivity(cases, now);
  const action = nextAction(queue, cases.length);
  const proof = proofQualityStatus(kpis.avgProof, kpis.proofScored);

  const hidden = curated.hidden.length;

  return (
    <div className="mx-auto max-w-[var(--layout-page-max)] space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <Reveal index={0} className="space-y-4">
        <PageHeader
          eyebrow="Vue portefeuille"
          title="Tableau de bord"
          description={
            <>
              État des dossiers actifs au{" "}
              <time dateTime={now.toISOString()}>{formatDateTimeFr(now)}</time> (heure de Paris).
              {hidden > 0
                ? ` ${hidden} dossier${s(hidden)} masqué${s(hidden)} : doublons ou erreurs.`
                : ""}
            </>
          }
          actions={
            <Link href="/cases" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FolderOpen aria-hidden /> Tous les dossiers
            </Link>
          }
        />
        <NextActionBanner action={action} />
      </Reveal>

      <Reveal index={1} as="section" aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">
          Indicateurs du portefeuille
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Dossiers actifs"
            value={fr(kpis.cases)}
            icon={FolderOpen}
            href="/cases"
            context={
              kpis.cases === 0
                ? "Aucun dossier créé"
                : [
                    kpis.byStatus.ready > 0 && `${fr(kpis.byStatus.ready)} prêt${s(kpis.byStatus.ready)}`,
                    kpis.byStatus.enriching > 0 && `${fr(kpis.byStatus.enriching)} en enrichissement`,
                    kpis.byStatus.draft > 0 && `${fr(kpis.byStatus.draft)} brouillon${s(kpis.byStatus.draft)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <StatCard
            label="Signaux élevés"
            value={fr(kpis.signalsHigh)}
            icon={ShieldAlert}
            status={
              kpis.signalsHigh > 0
                ? { tone: "critical", label: "À instruire" }
                : { tone: "success", label: "Aucun" }
            }
            context={
              kpis.signalsHigh > 0
                ? `Sur ${fr(kpis.casesWithHigh)} dossier${s(kpis.casesWithHigh)}`
                : "Sévérité élevée, tous dossiers actifs"
            }
          />
          <StatCard
            label="Qualité de preuve moyenne"
            value={kpis.proofScored > 0 ? kpis.avgProof : "—"}
            unit={kpis.proofScored > 0 ? "/100" : undefined}
            icon={BadgeCheck}
            status={proof}
            context={
              kpis.proofScored > 0
                ? `Moyenne sur ${fr(kpis.proofScored)} dossier${s(kpis.proofScored)} scoré${s(kpis.proofScored)}`
                : "Aucun dossier ne porte encore ce score"
            }
          />
          <StatCard
            label="Entités cartographiées"
            value={fr(kpis.entities)}
            icon={Building2}
            context={`${fr(kpis.edges)} lien${s(kpis.edges)} · ${fr(kpis.cases)} dossier${s(kpis.cases)}`}
          />
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal index={2} className="min-w-0 lg:col-span-7 xl:col-span-8">
          <ReviewQueuePanel queue={queue} totalCases={cases.length} />
        </Reveal>
        <Reveal index={2} className="min-w-0 lg:col-span-5 xl:col-span-4">
          <RiskSignalsPanel signals={signals} totalCases={cases.length} />
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal index={3} className="min-w-0 lg:col-span-7 xl:col-span-8">
          <RecentActivityPanel
            items={activity.items}
            updatedInWindow={activity.updatedInWindow}
            now={now}
          />
        </Reveal>
        <Reveal index={3} className="min-w-0 lg:col-span-5 xl:col-span-4">
          <QuickAccessPanel />
        </Reveal>
      </div>
    </div>
  );
}
