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
import AppSidebar from "@/components/shell/AppSidebar";
import TopBar from "@/components/shell/TopBar";
import CommandPalette from "@/components/shell/CommandPalette";
import PageMotion from "@/components/shell/PageMotion";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { curateCaseSummaries } from "@/lib/data/case-curation";
import { isDemoMode } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cases = await getCasesRepository().listCases();
  const curated = curateCaseSummaries(cases);
  const demoMode = isDemoMode();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar demoMode={demoMode} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar demoMode={demoMode} />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <PageMotion>{children}</PageMotion>
          </main>
        </div>
      </div>
      <CommandPalette cases={curated.visible} />
      <Toaster position="bottom-right" theme="dark" />
    </TooltipProvider>
  );
}
