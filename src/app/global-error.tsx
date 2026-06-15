"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#0a1628] px-6 text-[#e8eef7]">
          <div className="max-w-md text-center">
            <TriangleAlert className="mx-auto text-[#f59e0b]" size={36} />
            <h1 className="mt-5 text-3xl font-bold">Erreur critique</h1>
            <p className="mt-3 text-sm leading-6 text-[#8aa0bd]">
              L'application a rencontre une erreur globale. Aucune donnee de
              dossier n'est exposee dans cet ecran.
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-xs text-[#8aa0bd]">
                Digest {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#15c2b8] px-4 py-2 text-sm font-medium text-[#04201d]"
            >
              <RotateCcw size={15} /> Reessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
