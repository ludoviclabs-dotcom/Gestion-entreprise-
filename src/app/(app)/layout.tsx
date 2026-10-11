// Co-localisation avec Neon (eu-central-1) pour toutes les pages du shell —
// elles lisent le repository à chaque rendu (cf. docs/sovereignty.md).
export const preferredRegion = "fra1";

// Rendu à CHAQUE requête. Sans cela, Next prérend `/cases`, `/dashboard`… au
// build (ces pages ne lisent ni cookies ni en-têtes) : la liste des dossiers et
// la palette de commandes restent figées au dernier déploiement et un dossier
// qu'on vient de créer n'apparaît pas.
export const dynamic = "force-dynamic";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/shell/AppShell";
import AppSidebar from "@/components/shell/AppSidebar";
import TopBar from "@/components/shell/TopBar";
import CommandPalette from "@/components/shell/CommandPalette";
import PageMotion from "@/components/shell/PageMotion";
import type { NavReview } from "@/components/shell/nav";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { curateCaseSummaries } from "@/lib/data/case-curation";
import { buildReviewQueue } from "@/lib/dashboard/portfolio";
import { isDemoMode } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cases = await getCasesRepository().listCases();
  const curated = curateCaseSummaries(cases);
  const demoMode = isDemoMode();

  // Compteur « dossiers à revoir » de la navigation : même file que le tableau
  // de bord, calculée sur la liste déjà chargée (aucune requête de plus).
  const queue = buildReviewQueue(curated.visible);
  const review: NavReview = {
    count: queue.length,
    tone: queue.some((item) => item.reasons[0]?.tone === "critical") ? "critical" : "vigilance",
  };

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell
        sidebar={<AppSidebar review={review} />}
        topbar={<TopBar demoMode={demoMode} review={review} />}
      >
        <PageMotion>{children}</PageMotion>
      </AppShell>
      <CommandPalette cases={curated.visible} />
      {/* Le thème des toasts suit le thème de l'application (next-themes). */}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
