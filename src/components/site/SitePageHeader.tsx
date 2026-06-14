import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * En-tête commun des pages de contenu publiques (back-link vers l'accueil,
 * titre, chapeau). Calqué sur l'en-tête de src/app/secteurs/page.tsx.
 */
export function SitePageHeader({
  title,
  intro,
  eyebrow,
  cta,
}: {
  title: string;
  intro: string;
  eyebrow?: string;
  cta?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-surface px-6 py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft size={15} /> KYB Graph
          </Link>
          {eyebrow ? (
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-violet">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            {intro}
          </p>
        </div>
        {cta}
      </div>
    </header>
  );
}
