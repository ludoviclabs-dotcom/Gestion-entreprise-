"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <TriangleAlert className="mx-auto text-amber" size={36} />
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-bold">
          Erreur d'affichage
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Une erreur a interrompu le rendu. Les exports et donnees sensibles ne
          sont pas exposes dans cet ecran.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Digest {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <RotateCcw size={15} /> Reessayer
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
