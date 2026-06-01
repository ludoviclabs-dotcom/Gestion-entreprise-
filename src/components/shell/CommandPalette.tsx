"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  FilePlus2,
  Building2,
} from "lucide-react";
import type { CaseSummary } from "@/lib/data/types";

export default function CommandPalette({ cases }: { cases: CaseSummary[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    // Ouverture depuis un clic externe (champ de recherche de la topbar).
    const onOpen = () => setOpen(true);
    window.addEventListener("kyb:open-command", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("kyb:open-command", onOpen);
    };
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher une commande, un dossier…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard /> Tableau de bord
          </CommandItem>
          <CommandItem onSelect={() => go("/cases")}>
            <FolderOpen /> Dossiers
          </CommandItem>
          <CommandItem onSelect={() => go("/reglages")}>
            <Settings /> Réglages
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/cases/new")}>
            <FilePlus2 /> Nouveau dossier
          </CommandItem>
        </CommandGroup>
        {cases.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Dossiers">
              {cases.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.title} ${c.rootSiren}`}
                  onSelect={() => go(`/cases/${c.id}/graphe`)}
                >
                  <Building2 /> {c.title}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {c.rootSiren}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
