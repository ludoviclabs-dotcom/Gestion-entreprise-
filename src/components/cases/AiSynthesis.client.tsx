"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Copy,
  Loader2,
  RefreshCw,
  ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { saveSynthesisAction } from "@/app/(app)/cases/actions";
import { buildBriefing, type BriefingSource } from "@/lib/synthesis/briefing";
import type { CaseBundle } from "@/lib/graph/graph-types";

/**
 * Synthèse manuelle via Claude Code (zéro frais API).
 *  - Si une synthèse est déjà persistée → affichage + bouton « Régénérer ».
 *  - Sinon → bouton « Préparer un briefing » qui ouvre la Dialog copier-coller.
 *  - La Dialog contient : briefing Markdown copiable + zone réponse + bouton
 *    Enregistrer (Server Action saveSynthesisAction — qui vérifie que la
 *    réponse cite au moins une règle déclenchée).
 */
export default function AiSynthesis({
  bundle,
  sources = [],
}: {
  bundle: CaseBundle;
  sources?: BriefingSource[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [pending, startTransition] = useTransition();

  const briefing = buildBriefing(bundle, sources);
  const existing = bundle.case.synthesis;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(briefing);
      toast.success("Briefing copié", {
        description: "Colle-le dans ta session Claude Code pour obtenir la synthèse.",
      });
    } catch {
      toast.error("Impossible de copier — sélectionne le texte manuellement.");
    }
  };

  const handleSave = () => {
    const trimmed = response.trim();
    if (trimmed.length < 20) {
      toast.error("Réponse trop courte (minimum 20 caractères).");
      return;
    }
    startTransition(async () => {
      const res = await saveSynthesisAction(bundle.case.id, trimmed);
      if (res.ok) {
        toast.success("Synthèse enregistrée");
        setOpen(false);
        setResponse("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const openDialog = () => {
    setResponse("");
    setOpen(true);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles size={14} />
            </span>
            <div>
              <p className="text-sm font-medium">
                {existing ? "Synthèse Claude Code" : "Synthèse via Claude Code"}
              </p>
              <p className="text-xs text-muted-foreground">
                {existing
                  ? `Rédigée le ${new Date(existing.updatedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}.`
                  : "Workflow manuel — copie le briefing dans ta session Claude Code, colle la réponse ici."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openDialog}
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition hover:border-primary/50"
          >
            {existing ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            {existing ? "Régénérer" : "Préparer un briefing"}
          </button>
        </div>

        {existing && (
          <div className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
            {existing.content}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Synthèse via Claude Code</DialogTitle>
            <DialogDescription>
              Copie le briefing ci-dessous, colle-le dans une session Claude
              Code, puis colle la réponse générée dans la zone du bas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Briefing */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  1. Briefing à copier
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs transition hover:border-primary/50"
                >
                  <Copy size={12} /> Copier le briefing
                </button>
              </div>
              <ScrollArea className="h-48 rounded-lg border border-border bg-background">
                <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-foreground">
                  {briefing}
                </pre>
              </ScrollArea>
            </div>

            {/* Réponse */}
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ClipboardPaste size={12} /> 2. Réponse de Claude Code
              </p>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Colle ici la synthèse générée par Claude Code…"
                rows={10}
                className="resize-none rounded-lg border border-border bg-background p-3 text-sm leading-relaxed focus:border-primary focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground">
                {response.trim().length} caractère
                {response.trim().length > 1 ? "s" : ""} — minimum 20 pour
                enregistrer. La réponse doit citer les identifiants des règles
                déclenchées (ex. ECART_UBO_DECLARE), sinon l&apos;enregistrement
                est refusé.
              </p>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm transition hover:border-primary/50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || response.trim().length < 20}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {pending && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
