"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  searchCompaniesAction,
  createCaseAction,
} from "@/app/(app)/cases/actions";
import type { CompanyCandidate } from "@/lib/data/types";

export default function NewCaseDialog({
  children,
  defaultOpen = false,
}: {
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CompanyCandidate[]>([]);
  const [searching, startSearch] = useTransition();
  const [creating, startCreate] = useTransition();
  const [searched, setSearched] = useState(false);

  const runSearch = () => {
    if (!query.trim()) return;
    startSearch(async () => {
      const res = await searchCompaniesAction(query);
      setCandidates(res);
      setSearched(true);
    });
  };

  const pick = (siren: string) => {
    startCreate(async () => {
      const res = await createCaseAction(siren);
      if (res.ok) {
        toast.success("Dossier créé", {
          description: "Enrichissement effectué à partir des sources de démonstration.",
        });
        setOpen(false);
        router.push(`/cases/${res.id}/graphe`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
          <DialogDescription>
            Recherchez une société par nom ou SIREN, puis sélectionnez-la pour
            créer le dossier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Nom ou SIREN (ex. Danone, 552032534)"
          />
          <Button onClick={runSearch} disabled={searching} variant="secondary">
            {searching ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Search />
            )}
            Rechercher
          </Button>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {searched && candidates.length === 0 && !searching && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune société trouvée.
            </p>
          )}
          {candidates.map((c) => (
            <button
              key={c.siren}
              type="button"
              disabled={creating}
              onClick={() => pick(c.siren)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/50 disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Building2 size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {c.denomination ?? `SIREN ${c.siren}`}
                </span>
                <span className="block text-xs text-muted-foreground">
                  SIREN {c.siren}
                  {c.naf ? ` · ${c.naf}` : ""}
                </span>
              </span>
              {creating && <Loader2 size={16} className="animate-spin" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
