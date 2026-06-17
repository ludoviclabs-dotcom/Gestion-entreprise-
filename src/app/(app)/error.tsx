"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Frontière d'erreur scopée au shell applicatif. Rendue À L'INTÉRIEUR du layout
 * `(app)` (sidebar + top bar conservés), elle capture les erreurs de rendu d'un
 * dossier (layout/onglet) sans renvoyer l'utilisateur vers l'écran plein cadre
 * du boundary racine : il garde sa navigation et peut réessayer ou changer de
 * dossier. L'erreur réelle est journalisée (logs serveur + Sentry global).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erreur de rendu d'une page du shell", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
        <TriangleAlert className="mx-auto text-amber" size={32} />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold">
          Cette vue n&apos;a pas pu s&apos;afficher
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Une erreur a interrompu le rendu de cette page. Vos autres dossiers
          restent accessibles ; aucune donnée sensible n&apos;est exposée ici.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Digest {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <RotateCcw size={15} /> Réessayer
          </button>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-2"
          >
            Mes dossiers
          </Link>
        </div>
      </div>
    </div>
  );
}
