import Link from "next/link";
import { ArrowRight, FlaskConical, Network, ShieldAlert } from "lucide-react";
import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";

export const metadata = {
  title: "Lab KYB — KYB Graph",
  description:
    "Expériences pédagogiques interactives autour de la conformité KYB, des graphes de relations et des signaux LCB-FT.",
};

export default function LabPage() {
  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <SitePageHeader
          eyebrow="Lab KYB"
          title="Expériences pédagogiques"
          intro="Un espace pour entraîner les réflexes d'analyse KYB : graphes de contrôle, signaux faibles, arbitrages de preuve et verdicts documentés."
        />

        <section className="px-6 py-10">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Link
              href="/lab/fraud-detective"
              className="group overflow-hidden rounded-lg border border-border bg-surface text-foreground transition hover:-translate-y-0.5 hover:border-violet/60 hover:shadow-[0_24px_70px_rgba(21,194,184,0.12)]"
            >
              <div className="relative min-h-[420px] bg-[#080f1d] p-6">
                <div className="absolute inset-0 bg-grid opacity-70" aria-hidden />
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(21,194,184,0.25),transparent_32%),radial-gradient(circle_at_76%_72%,rgba(245,158,11,0.16),transparent_30%)]"
                  aria-hidden
                />
                <div className="relative z-10 flex h-full min-h-[372px] flex-col justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3 py-1 text-xs font-medium text-violet">
                      <FlaskConical size={14} /> Expérience jouable
                    </span>
                    <h2 className="mt-6 font-[family-name:var(--font-display)] text-4xl font-bold text-white">
                      Fraud Detective
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                      Enquêtez sur un graphe fictif, inspectez les entités, signalez les liens suspects et comparez
                      votre verdict aux motifs de fraude générés.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Graphes", icon: Network },
                      { label: "Fraude KYB", icon: ShieldAlert },
                      { label: "Replay", icon: ArrowRight },
                    ].map((item) => (
                      <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                        <item.icon className="text-violet" size={20} />
                        <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <span className="inline-flex w-fit items-center gap-3 rounded-md bg-violet px-5 py-3 text-sm font-semibold text-[#04201d] transition group-hover:bg-violet/90">
                    Lancer l'investigation <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </Link>

            <div className="grid content-start gap-4">
              <div className="rounded-lg border border-border bg-surface p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  Pourquoi un Lab ?
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Le Lab complète les pages publiques sans les remplacer : il sert à démontrer concrètement les
                  raisonnements KYB, sous forme d'exercices courts et autonomes.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  Données fictives
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Chaque dossier Fraud Detective est généré localement dans le navigateur. Aucun signalement, score ou
                  rapport exporté n'est envoyé à KYB Graph.
                </p>
              </div>
              <div className="rounded-lg border border-amber/35 bg-surface p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-amber">
                  Usage pédagogique
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Les motifs sont simplifiés pour l'entraînement. Une proximité de graphe ou une anomalie déclarative
                  ne constitue jamais, seule, une preuve de fraude.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
