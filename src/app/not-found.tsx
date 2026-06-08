import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <SearchX className="mx-auto text-muted-foreground" size={34} />
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl font-bold">
          Page introuvable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Le dossier ou la page demandee n'existe pas, ou n'est plus disponible
          dans cet environnement.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <ArrowLeft size={15} /> Retour au dashboard
        </Link>
      </div>
    </main>
  );
}
