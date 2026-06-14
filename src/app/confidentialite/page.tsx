import { ShieldOff } from "lucide-react";
import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { RegulatoryAnchor } from "@/components/site/RegulatoryAnchor";
import {
  LEGAL_BASES,
  PRIVACY_PRINCIPLES,
  WHAT_WE_DONT_CONCLUDE,
  GUARDRAILS,
  PRIVACY_REFS,
} from "@/lib/domain/privacy";

export const metadata = {
  title: "Confidentialité & RGPD — KYB Graph",
  description:
    "Base légale (intérêt légitime, CJUE 2022), minimisation, rétention 5 ans après la fin de la relation d'affaires (AMLR), garde-fous produit et périmètre des conclusions.",
};

export default function ConfidentialitePage() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
      <SitePageHeader
        eyebrow="Confidentialité & RGPD"
        title="Protection des données et rétention"
        intro="KYB Graph manipule par construction des données personnelles (dirigeants, bénéficiaires effectifs). Voici les bases légales, les durées de conservation et les garde-fous qui encadrent leur traitement."
      />

      <Section title="Base légale">
        <div className="grid gap-3 md:grid-cols-2">
          {LEGAL_BASES.map((b) => (
            <div
              key={b.title}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Principes de traitement">
        <div className="grid gap-3 md:grid-cols-2">
          {PRIVACY_PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <p className="text-sm font-semibold text-emerald">{p.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Ce que KYB Graph ne conclut pas">
        <div className="rounded-lg border border-red/40 bg-surface p-5">
          <div className="flex items-center gap-2 text-red">
            <ShieldOff size={18} />
            <span className="text-sm font-semibold">Posture méthodologique</span>
          </div>
          <ul className="mt-3 space-y-2">
            {WHAT_WE_DONT_CONCLUDE.map((item) => (
              <li
                key={item}
                className="text-sm leading-6 text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        title="Garde-fous produit"
        subtitle="Chaque garde-fou technique répond à une exigence réglementaire précise."
      >
        <div className="overflow-hidden rounded-lg border border-border">
          {GUARDRAILS.map((g, i) => (
            <div
              key={g.measure}
              className={`grid gap-2 p-4 md:grid-cols-2 md:gap-6 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <p className="text-sm font-medium text-foreground">{g.measure}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {g.justification}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Références">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PRIVACY_REFS.map((ref) => (
            <RegulatoryAnchor key={ref.label} source={ref} />
          ))}
        </div>
      </Section>

      </main>
      <PublicFooter />
    </>
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
