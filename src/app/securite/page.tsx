import Link from "next/link";
import { ExternalLink, Mail } from "lucide-react";
import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import {
  HOSTING_LAYERS,
  SUB_PROCESSORS,
  NOTIFICATION_COMMITMENT,
  CERTIFICATIONS,
  SECURITY_CONTACT,
} from "@/lib/domain/trust";

export const metadata = {
  title: "Sécurité & confiance — KYB Graph",
  description:
    "Trust center : où vivent les données, sous-traitants RGPD (art. 28), trajectoire de certification (SOC 2, ISO 27001, SecNumCloud) et contact sécurité.",
};

export default function SecuritePage() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
      <SitePageHeader
        eyebrow="Sécurité & confiance"
        title="Trust center"
        intro="Ce que KYB Graph prouve publiquement sur l'hébergement, les sous-traitants et la sécurité. Pour le détail de la trajectoire souveraine, voir la page Souveraineté ; pour le traitement des données personnelles, la page Confidentialité."
        cta={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/souverainete"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Souveraineté
            </Link>
            <Link
              href="/confidentialite"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Confidentialité
            </Link>
          </div>
        }
      />

      <Section
        title="Où vivent les données"
        subtitle="Chaque couche, son hébergeur, sa région et la nature des données traitées."
      >
        <div className="grid gap-3">
          {HOSTING_LAYERS.map((l) => (
            <div
              key={l.layer}
              className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-center"
            >
              <div>
                <p className="text-sm font-semibold">{l.layer}</p>
                <p className="mt-1 text-xs text-violet">{l.provider}</p>
                <p className="mt-1 text-xs text-muted-foreground">{l.region}</p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {l.dataScope}
              </p>
              <span
                className={`justify-self-start rounded-md border px-2 py-1 text-xs font-medium md:justify-self-end ${
                  l.sovereign
                    ? "border-emerald/40 text-emerald"
                    : "border-amber/40 text-amber"
                }`}
              >
                {l.sovereign ? "Souverain" : "Hors UE / CLOUD Act"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Sous-processeurs (RGPD art. 28)"
        subtitle={NOTIFICATION_COMMITMENT}
      >
        <div className="overflow-hidden rounded-lg border border-border">
          {SUB_PROCESSORS.map((s, i) => (
            <div
              key={s.name}
              className={`grid gap-2 p-4 md:grid-cols-[1fr_1fr_1.3fr_auto] md:items-center md:gap-6 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                {s.service}
                <span className="block text-xs">{s.region}</span>
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {s.dataScope}
              </p>
              <a
                href={s.dpaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 justify-self-start text-xs text-violet transition hover:underline md:justify-self-end"
              >
                DPA <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Certifications & trajectoire"
        subtitle="Conformité actuelle et objectifs datés. Aucune certification n'est revendiquée avant son obtention effective."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CERTIFICATIONS.map((c) => (
            <div
              key={c.name}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{c.name}</p>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    c.status === "actuel"
                      ? "border-emerald/40 text-emerald"
                      : "border-amber/40 text-amber"
                  }`}
                >
                  {c.statusLabel}
                </span>
              </div>
              {c.target ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Échéance : {c.target}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {c.note}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Contact sécurité">
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm leading-7 text-muted-foreground">
            {SECURITY_CONTACT.statement}
          </p>
          <a
            href={`mailto:${SECURITY_CONTACT.email}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Mail size={15} /> {SECURITY_CONTACT.email}
          </a>
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
