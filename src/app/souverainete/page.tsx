import { ShieldCheck } from "lucide-react";
import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { RegulatoryAnchor } from "@/components/site/RegulatoryAnchor";
import {
  SOVEREIGNTY_STATUS,
  SOVEREIGNTY_FRAMEWORK,
  QUALIFIED_PROVIDERS,
  SOVEREIGNTY_COMPONENTS,
  MIGRATION_STEPS,
} from "@/lib/domain/sovereignty";

export const metadata = {
  title: "Souveraineté & hébergement — KYB Graph",
  description:
    "Trajectoire d'hébergement souverain : démonstrateur Vercel aujourd'hui, cible SecNumCloud qualifiée, jalons de migration et cadre réglementaire (Cloud au centre, loi SREN, AMLR, CJUE).",
};

export default function SouverainetePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SitePageHeader
        eyebrow="Souveraineté & hébergement"
        title="Une trajectoire vers un hébergement souverain"
        intro={SOVEREIGNTY_STATUS.headline}
      />

      <section className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg border border-amber/40 bg-surface p-5">
            <div className="flex items-center gap-2 text-amber">
              <ShieldCheck size={18} />
              <span className="text-sm font-semibold">
                {SOVEREIGNTY_STATUS.badge}
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {SOVEREIGNTY_STATUS.body}
            </p>
          </div>
        </div>
      </section>

      <Section title="Cadre réglementaire et doctrinal">
        <div className="grid gap-3 md:grid-cols-2">
          {SOVEREIGNTY_FRAMEWORK.map((ref) => (
            <RegulatoryAnchor key={ref.label} source={ref} />
          ))}
        </div>
      </Section>

      <Section title="Fournisseurs SecNumCloud qualifiés">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {QUALIFIED_PROVIDERS.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-xs text-violet">{p.datacenters}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {p.note}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Aujourd'hui vs cible souveraine"
        subtitle="Chaque composant de KYB Graph et sa cible d'hébergement qualifié."
      >
        <div className="grid gap-3">
          {SOVEREIGNTY_COMPONENTS.map((c) => (
            <div
              key={c.component}
              className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[1fr_1fr_auto] md:items-center"
            >
              <div>
                <p className="text-sm font-semibold">{c.component}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aujourd&apos;hui : {c.today}
                </p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="text-emerald">Cible : </span>
                {c.target}
              </p>
              <span
                className={`justify-self-start rounded-md border px-2 py-1 text-xs font-medium md:justify-self-end ${
                  c.sovereign
                    ? "border-emerald/40 text-emerald"
                    : "border-amber/40 text-amber"
                }`}
              >
                {c.sovereign ? "Déjà souverain" : "À migrer"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Jalons de migration"
        subtitle="La migration souveraine est déclenchée par des événements commerciaux explicites — pas avant."
      >
        <ol className="grid gap-3">
          {MIGRATION_STEPS.map((step, i) => (
            <li
              key={step.trigger}
              className="flex gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet/15 text-sm font-semibold text-violet">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.trigger}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {step.action}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <PublicFooter />
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}
