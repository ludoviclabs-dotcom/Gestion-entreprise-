"use client";

import { Search } from "lucide-react";
import MobileSidebar from "./MobileSidebar";

/** Barre supérieure : hamburger (mobile) + champ ⌘K. */
export default function TopBar({ demoMode }: { demoMode: boolean }) {
  const openPalette = () => window.dispatchEvent(new Event("kyb:open-command"));

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/60 px-4 backdrop-blur">
      <MobileSidebar demoMode={demoMode} />
      <button
        type="button"
        onClick={openPalette}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition hover:border-primary/50"
      >
        <Search size={15} />
        <span>Rechercher…</span>
        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
