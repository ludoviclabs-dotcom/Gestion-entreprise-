"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

/**
 * Bandeau « Synthèse IA » sur l'onglet Risques. Appelle l'endpoint serveur
 * /cases/[caseId]/synthesis qui pilote Claude via Vercel AI SDK.
 *
 * Si la clé Anthropic n'est pas configurée, l'utilisateur reçoit un message
 * explicite (HTTP 503 → texte JSON décodé proprement).
 */
export default function AiSynthesis({ caseId }: { caseId: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStatus("loading");
    setText("");
    setError(null);
    try {
      const res = await fetch(`/cases/${caseId}/synthesis`, { method: "POST" });
      if (!res.ok) {
        const body = await res.text();
        try {
          const json = JSON.parse(body);
          setError(json.error ?? body);
        } catch {
          setError(body || `Erreur HTTP ${res.status}`);
        }
        setStatus("error");
        return;
      }
      if (!res.body) {
        setError("Réponse vide.");
        setStatus("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles size={14} />
          </span>
          <div>
            <p className="text-sm font-medium">Synthèse IA</p>
            <p className="text-xs text-muted-foreground">
              Lecture analytique du dossier par Claude — sans jamais qualifier de
              fraude.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={status === "loading"}
          className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition hover:border-primary/50 disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : status === "done" ? (
            <RefreshCw size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          {status === "loading"
            ? "Génération…"
            : status === "done"
              ? "Régénérer"
              : "Générer la synthèse"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-amber/40 bg-amber/10 p-2.5 text-xs text-amber">
          {error}
        </p>
      )}

      {text && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}
