"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileSidebar from "./MobileSidebar";
import ThemeToggle from "./ThemeToggle";

/**
 * Barre supérieure : [start] · champ de recherche ⌘K · [end].
 * Par défaut : hamburger (mobile) à gauche, bascule de thème à droite. Les slots
 * `start` / `end` permettent de recomposer la barre sans la dupliquer.
 */
export default function TopBar({
  demoMode,
  start,
  end,
  className,
}: {
  demoMode: boolean;
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  const openPalette = () => window.dispatchEvent(new Event("kyb:open-command"));

  return (
    <header
      data-slot="topbar"
      className={cn(
        "z-[var(--z-sticky)] flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm",
        className,
      )}
    >
      {start ?? <MobileSidebar demoMode={demoMode} />}
      <button
        type="button"
        onClick={openPalette}
        className="transition-ui flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-border-strong bg-sunken px-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        <Search size={15} aria-hidden />
        <span>Rechercher…</span>
        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-micro text-subtle">
          ⌘K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {end ?? <ThemeToggle />}
      </div>
    </header>
  );
}
