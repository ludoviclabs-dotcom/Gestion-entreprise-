import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  FileSearch,
  ShieldAlert,
} from "lucide-react";
import { SECTOR_THREAT_PROFILES } from "@/lib/domain/sector-threats";
import { SourceHealthStrip } from "@/components/site/SourceHealthStrip";
import { PublicFooter } from "@/components/site/PublicFooter";

export const metadata = {
  title: "Secteurs 2026 - KYB Graph",
  description:
    "Matrice des menaces 2026, signaux KYB, preuves attendues et limites par secteur.",
};

export default function SectorsPage() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft size={15} /> KYB Graph
            </Link>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold">
              Menaces 2026 par secteur
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              Une matrice de demonstration pour analystes conformite, audit KYB
              et due diligence B2B. Chaque ligne indique ce que KYB Graph peut
              observer, quelle preuve rattacher et ce qui doit rester hors
              conclusion automatique.
            </p>
          </div>
          <Link
            href="/cases/demo"
            className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-medium text-[#04201d] transition hover:opacity-90"
          >
            Ouvrir la demo
          </Link>
        </div>
      </header>

      <section className="px-6 pt-8">
        <div className="mx-auto max-w-6xl">
          <SourceHealthStrip />
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <ShieldAlert className="text-amber" size={20} />
            <h2 className="mt-3 font-semibold">Menaces</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Societes ecrans, sanctions, ransomware, supply-chain et controle
              indirect sont traites comme signaux a documenter.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <FileSearch className="text-violet" size={20} />
            <h2 className="mt-3 font-semibold">Preuves</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Source records, evidence, PDF et JSON rendent visible le niveau de
              preuve et l'origine live, mixed ou fixture.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <BadgeCheck className="text-emerald" size={20} />
            <h2 className="mt-3 font-semibold">Limites</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Le produit documente les diligences et les hypotheses. La decision
              reste humaine, contextualisee et conforme aux droits applicables.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-6xl gap-5">
          {SECTOR_THREAT_PROFILES.map((profile) => (
            <article
              key={profile.slug}
              id={profile.slug}
              className="border-t border-border py-7"
            >
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                    {profile.sector}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {profile.exposure}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.officialSources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        {source.label} <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <MatrixBlock
                    title="Menaces 2026"
                    tone="text-amber"
                    items={profile.threats2026}
                  />
                  <MatrixBlock
                    title="Signaux KYB Graph"
                    tone="text-violet"
                    items={profile.kybSignals}
                  />
                  <MatrixBlock
                    title="Preuves attendues"
                    tone="text-emerald"
                    items={profile.requiredEvidence}
                  />
                  <MatrixBlock
                    title="Limites"
                    tone="text-red"
                    items={profile.limitations}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      </main>
      <PublicFooter />
    </>
  );
}

function MatrixBlock({
  title,
  tone,
  items,
}: {
  title: string;
  tone: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className={`text-sm font-semibold ${tone}`}>{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
