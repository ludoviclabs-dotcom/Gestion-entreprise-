import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Coque applicative : [ sidebar | topbar + contenu ]. Ne contient AUCUNE donnée
 * ni logique de navigation — elle assemble ce qu'on lui passe (Sidebar, Topbar).
 *
 *   - plein écran (`h-dvh`), le défilement vit dans <main> ;
 *   - lien d'évitement « Aller au contenu principal » (premier élément focusable) ;
 *   - `canvas="grid"` : grille technique très discrète derrière le contenu — à
 *     réserver aux vues où elle porte la hiérarchie (carte, graphe), jamais sous
 *     du texte dense.
 *
 * Fournisseurs globaux (TooltipProvider, Toaster, palette de commandes) restent
 * dans le layout qui monte la coque : (app)/layout.tsx.
 */
export default function AppShell({
  sidebar,
  topbar,
  children,
  canvas = "plain",
  contentId = "contenu",
  className,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  canvas?: "plain" | "grid";
  contentId?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        "relative flex h-dvh overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <a
        href={`#${contentId}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[var(--z-skip-link)] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main
          id={contentId}
          tabIndex={-1}
          data-canvas={canvas}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto focus:outline-none",
            canvas === "grid" && "bg-tech-grid",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
