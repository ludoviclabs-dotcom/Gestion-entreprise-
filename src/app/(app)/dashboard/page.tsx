import Link from "next/link";
import { FolderOpen, ShieldAlert, BadgeCheck, Building2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import KpiCard from "@/components/cases/KpiCard";
import CaseStatusBadge from "@/components/cases/CaseStatusBadge";
import ScorePills from "@/components/cases/ScorePills";
import CaseQualityBadges from "@/components/cases/CaseQualityBadges";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { curateCaseSummaries } from "@/lib/data/case-curation";

export const metadata = { title: "Tableau de bord — KYB Graph" };

export default async function DashboardPage() {
  const allCases = await getCasesRepository().listCases();
  const curated = curateCaseSummaries(allCases);
  const cases = curated.visible;

  const totalCompanies = cases.reduce((n, c) => n + c.counts.entities, 0);
  const totalHigh = cases.reduce((n, c) => n + c.counts.signalsHigh, 0);
  const withProof = cases.filter((c) => c.scores.qualitePreuve !== undefined);
  const avgProof =
    withProof.length > 0
      ? Math.round(
          withProof.reduce((n, c) => n + (c.scores.qualitePreuve ?? 0), 0) /
            withProof.length,
        )
      : 0;
  const recent = cases.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue d&apos;ensemble de vos dossiers de cartographie.
            {curated.hidden.length > 0
              ? ` ${curated.hidden.length} dossier(s) masque(s): doublons ou erreurs.`
              : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/cases/new">Nouveau dossier</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Dossiers" value={cases.length} icon={FolderOpen} />
        <KpiCard
          label="Signaux élevés"
          value={totalHigh}
          icon={ShieldAlert}
          accent="var(--red)"
          hint="à vérifier en priorité"
        />
        <KpiCard
          label="Qualité de preuve moy."
          value={`${avgProof}`}
          icon={BadgeCheck}
          accent="var(--emerald)"
        />
        <KpiCard
          label="Entités cartographiées"
          value={totalCompanies}
          icon={Building2}
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Dossiers récents
          </h2>
          <Link
            href="/cases"
            className="flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Tout voir <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid gap-3">
          {recent.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}/graphe`}>
              <Card className="flex-row items-center justify-between p-4 transition hover:border-primary/50">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Building2 size={16} />
                  </span>
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      SIREN {c.rootSiren} · {c.counts.entities} entités
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ScorePills scores={c.scores} size="sm" />
                  <CaseQualityBadges
                    origin={c.origin}
                    scoreStatus={c.scoreStatus}
                    sourceHealth={c.sourceHealth}
                    compact
                  />
                  <CaseStatusBadge status={c.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
