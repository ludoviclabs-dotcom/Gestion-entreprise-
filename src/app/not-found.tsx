import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import EmptyState from "@/components/empty/EmptyState";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <EmptyState
        variant="inline"
        titleAs="h1"
        icon={SearchX}
        title="Page introuvable"
        description="Le dossier ou la page demandee n'existe pas, ou n'est plus disponible dans cet environnement."
        action={
          <Link href="/dashboard" className={buttonVariants()}>
            <ArrowLeft size={15} aria-hidden /> Retour au dashboard
          </Link>
        }
      />
    </main>
  );
}
