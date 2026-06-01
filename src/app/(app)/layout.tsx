import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import AppSidebar from "@/components/shell/AppSidebar";
import TopBar from "@/components/shell/TopBar";
import CommandPalette from "@/components/shell/CommandPalette";
import PageMotion from "@/components/shell/PageMotion";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { isDemoMode } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cases = await getCasesRepository().listCases();
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
      <CommandPalette cases={cases} />
      <Toaster position="bottom-right" theme="dark" />
    </TooltipProvider>
  );
}
