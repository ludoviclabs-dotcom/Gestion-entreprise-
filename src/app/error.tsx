"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import ErrorState from "@/components/empty/ErrorState";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <ErrorState
        variant="inline"
        titleAs="h1"
        title="Erreur d'affichage"
        description="Une erreur a interrompu le rendu. Les exports et donnees sensibles ne sont pas exposes dans cet ecran."
        digest={error.digest}
        action={
          <>
            <Button type="button" onClick={reset}>
              <RotateCcw size={15} aria-hidden /> Reessayer
            </Button>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Dashboard
            </Link>
          </>
        }
      />
    </main>
  );
}
