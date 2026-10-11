"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import MobileSidebar from "./MobileSidebar";
import SessionStatus from "./SessionStatus";
import ThemeToggle from "./ThemeToggle";
import type { NavReview } from "./nav";
import { useModKey } from "./useModKey";

/** Ouvre la palette de recherche globale (écoutée par CommandPalette). */
export const OPEN_COMMAND_EVENT = "kyb:open-command";

/**
 * Barre supérieure : [menu mobile] · recherche globale (raccourci visible) ·
 * [action principale · thème · statut de session].
 * Les slots `start` / `end` permettent de recomposer la barre sans la dupliquer.
 *
 * Responsive : sous sm, la recherche devient un bouton icône et « Nouveau
 * dossier » ne garde que son icône (le libellé reste lu par les lecteurs d'écran).
 */
export default function TopBar({
  demoMode,
  review,
  start,
  end,
  className,
}: {
  demoMode: boolean;
  review?: NavReview;
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  const mod = useModKey();
  const openPalette = () => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));

  return (
    <header
      data-slot="topbar"
      className={cn(
        "z-[var(--z-sticky)] flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-sm sm:gap-3 sm:px-4",
        className,
      )}
    >
      {start ?? <MobileSidebar review={review} />}

      <button
        type="button"
        onClick={openPalette}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Recherche globale : dossier, SIREN ou page"
        data-slot="global-search"
        className="group hidden h-9 w-full max-w-md min-w-0 items-center gap-2 rounded-md border border-border-strong bg-sunken px-3 text-sm text-muted-foreground transition-ui outline-none hover:border-primary/50 hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-2 sm:flex"
      >
        <Search
          aria-hidden
          className="size-4 shrink-0 text-subtle transition-ui group-hover:text-primary"
        />
        <span className="truncate">
          Recherche globale
          <span className="hidden text-subtle md:inline"> · dossier, SIREN, page</span>
        </span>
        <kbd
          aria-hidden
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 font-sans text-micro font-medium text-subtle"
        >
          <span>{mod}</span>
          <span>K</span>
        </kbd>
      </button>
      <IconButton
        label="Recherche globale"
        icon={Search}
        variant="outline"
        tooltip={false}
        onClick={openPalette}
        aria-haspopup="dialog"
        className="sm:hidden"
      />

      <div className="ml-auto flex items-center gap-2">
        {end ?? (
          <>
            <Link
              href="/cases/new"
              className={cn(buttonVariants({ size: "sm" }), "h-9 px-2.5 sm:px-3")}
            >
              <Plus aria-hidden />
              <span className="sr-only sm:not-sr-only">Nouveau dossier</span>
            </Link>
            <ThemeToggle />
            <SessionStatus demoMode={demoMode} />
          </>
        )}
      </div>
    </header>
  );
}
