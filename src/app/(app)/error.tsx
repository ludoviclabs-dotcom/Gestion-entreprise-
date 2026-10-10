"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import ErrorState from "@/components/empty/ErrorState";

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
      <ErrorState
        titleAs="h1"
        title="Cette vue n'a pas pu s'afficher"
        description="Une erreur a interrompu le rendu de cette page. Vos autres dossiers restent accessibles ; aucune donnée sensible n'est exposée ici."
        digest={error.digest}
        action={
          <>
            <Button type="button" onClick={reset}>
              <RotateCcw size={15} aria-hidden /> Réessayer
            </Button>
            <Link href="/cases" className={buttonVariants({ variant: "outline" })}>
              Mes dossiers
            </Link>
          </>
        }
      />
    </div>
  );
}
