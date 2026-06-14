import Link from "next/link";
import { Network } from "lucide-react";
import { PUBLIC_NAV } from "@/components/site/nav-items";

/**
 * Footer public partagé par le landing, /secteurs et les pages de contenu.
 * Liens dérivés de la source unique PUBLIC_NAV.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base font-bold text-foreground"
          >
            <span className="text-violet" aria-hidden>
              <Network size={22} strokeWidth={2.3} />
            </span>
            KYB Graph
          </Link>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Cartographie de conformité KYB. Prouver ce que l&apos;on sait,
            signaler ce qui reste à vérifier — la décision reste humaine.
          </p>
        </div>

        <nav aria-label="Pied de page" className="flex flex-wrap gap-x-10 gap-y-3">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Application
          </Link>
        </nav>
      </div>

      <div className="mx-auto mt-8 max-w-6xl border-t border-border pt-6 text-xs leading-6 text-muted-foreground">
        Conforme LCB-FT · AMLR 2024/1624 · RGPD. Démonstrateur sur données
        fictives anonymisées — trajectoire d&apos;hébergement souverain détaillée
        sur la page{" "}
        <Link href="/souverainete" className="text-violet hover:underline">
          Souveraineté
        </Link>
        .
      </div>
    </footer>
  );
}
