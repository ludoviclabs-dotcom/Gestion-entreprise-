"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import ErrorState from "@/components/empty/ErrorState";

/**
 * Erreur du tableau de bord : la navigation (sidebar, recherche) reste
 * disponible ; on propose de réessayer ou d'ouvrir directement la liste des
 * dossiers. Aucun détail technique n'est affiché (digest seulement).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] erreur de rendu du tableau de bord", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <ErrorState
        titleAs="h1"
        title="Le tableau de bord n'a pas pu se charger"
        description="La lecture des dossiers a échoué. Vos dossiers ne sont pas modifiés : réessayez, ou ouvrez directement la liste."
        digest={error.digest}
        action={
          <>
            <Button type="button" onClick={reset}>
              <RotateCcw size={15} aria-hidden /> Réessayer
            </Button>
            <Link href="/cases" className={buttonVariants({ variant: "outline" })}>
              Liste des dossiers
            </Link>
          </>
        }
      />
    </div>
  );
}
