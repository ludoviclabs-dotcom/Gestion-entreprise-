import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Coins,
  Eye,
  FileText,
  FlaskConical,
  Landmark,
  Network,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { SitePageHeader } from "@/components/site/SitePageHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { FictionBanner } from "@/components/learning/FictionBanner";
import { CONTROLE_ACTIFS, CRYPTO_FLUX } from "@/lib/learning/paths";

const GUIDED_PATHS = [
  { path: CONTROLE_ACTIFS, icon: Landmark },
  { path: CRYPTO_FLUX, icon: Coins },
];

/** Déroulé commun aux deux parcours (cadrage §12.3, « Parcours »). */
const STAGES = [
  { title: "Situation", detail: "Les pièces de départ, sans conclusion." },
  { title: "Exploration", detail: "Des vues coordonnées, chacune avec sa question." },
  { title: "Hypothèses", detail: "Plusieurs explications, dont une licite." },
  { title: "Vérifications", detail: "Jusqu'à trois pièces à demander, à bien choisir." },
  { title: "Branche", detail: "Les pièces reçues ouvrent l'une des deux suites." },
  { title: "Débriefing", detail: "Signal, facteur, faisceau ou preuve : chaque niveau à sa place." },
];

export const metadata = {
  title: "Lab KYB — KYB Graph",
  description:
    "Parcours guidés et fictifs pour apprendre à lire contrôle, dépendances et flux de paiement, relier chaque affirmation à une pièce et reconnaître une conclusion indécidable.",
};

export default function LabPage() {
  return (
    <>
      <FictionBanner />
      <main className="min-h-screen bg-background text-foreground">
        <SitePageHeader
          eyebrow="Lab KYB"
          title="Expériences pédagogiques"
          intro="Deux parcours guidés pour apprendre à relier chaque affirmation à une pièce, à formuler plusieurs hypothèses et à reconnaître une explication licite ou une conclusion indécidable. Tous les cas sont fictifs."
        />

        <section className="px-6 py-10" aria-labelledby="parcours-guides">
          <div className="mx-auto max-w-6xl">
            <h2 id="parcours-guides" className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              Parcours guidés
            </h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {GUIDED_PATHS.map(({ path, icon: Icon }, i) => (
                <article key={path.slug} className="flex flex-col rounded-lg border border-border bg-surface p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet">
                      <Icon size={18} aria-hidden /> Parcours {i + 1}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                      {path.status === "disponible" ? "Jouable" : "Scénario en préparation"}
                    </span>
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold">
                    <Link href={`/lab/${path.slug}`} className="hover:text-violet">
                      {path.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm font-medium">{path.question}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Démonstrateur fictif : {path.scenarioTitle}. {path.level}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-6">
                    {path.objectives.slice(0, 3).map((o) => (
                      <li key={o} className="flex gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" aria-hidden />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                      <Clock size={12} aria-hidden /> Environ {path.durationMinutes} min
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                      <Eye size={12} aria-hidden /> {path.views.length} vues
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                      <BookOpen size={12} aria-hidden /> {path.notions.length} notions sourcées
                    </span>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                    {path.status === "disponible" ? (
                      <Link
                        href={`/lab/${path.slug}/scenario`}
                        className="inline-flex items-center gap-2 rounded-md bg-violet px-4 py-2.5 text-sm font-semibold text-[#04201d]"
                      >
                        Commencer le scénario<span className="sr-only"> {path.scenarioTitle}</span>
                        <ArrowRight size={16} aria-hidden />
                      </Link>
                    ) : null}
                    <Link
                      href={`/lab/${path.slug}`}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
                    >
                      Introduction et notions<span className="sr-only"> du parcours {i + 1}</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-10" aria-labelledby="deroule">
          <div className="mx-auto max-w-6xl">
            <h2 id="deroule" className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Comment se déroule un parcours
            </h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {STAGES.map((s, i) => (
                <li key={s.title} className="rounded-md border border-border bg-surface p-4">
                  <p className="text-xs font-semibold text-violet">{i + 1}</p>
                  <p className="mt-1 text-sm font-semibold">{s.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.detail}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">
              « Informations insuffisantes » est une réponse possible, et parfois la seule juste.
            </p>
          </div>
        </section>

        <section className="px-6 pb-10" aria-labelledby="regles">
          <div className="mx-auto max-w-6xl">
            <h2 id="regles" className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Les règles du Lab
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <FlaskConical size={16} className="text-amber-700 dark:text-amber" aria-hidden /> Données fictives
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Noms, pièces, montants et adresses sont inventés. La progression reste dans le navigateur&nbsp;; seul
                  l&apos;export du carnet, sur votre demande, produit un fichier.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ShieldCheck size={16} className="text-violet" aria-hidden /> Aucune accusation
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Une nationalité, une proximité dans le graphe ou un indicateur isolé ne qualifient personne. Une
                  hypothèse reste une hypothèse tant qu&apos;une pièce ne l&apos;établit pas.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Scale size={16} className="text-violet" aria-hidden /> Sources datées
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Les notions citent des textes et des publications d&apos;autorités, avec leur date de consultation et
                  leurs limites.
                </p>
                <Link
                  href="/lab/sources"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet"
                >
                  <FileText size={15} aria-hidden /> Voir les fiches sources
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-14" aria-labelledby="autre-experience">
          <div className="mx-auto max-w-6xl">
            <h2 id="autre-experience" className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Expérience libre
            </h2>
            <Link
              href="/lab/fraud-detective"
              className="group mt-4 flex flex-col gap-5 overflow-hidden rounded-lg border border-border bg-[#080f1d] p-6 text-white transition hover:border-violet/60 md:flex-row md:items-center md:justify-between"
            >
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3 py-1 text-xs font-medium text-violet">
                  <FlaskConical size={14} aria-hidden /> Expérience jouable
                </span>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold">Fraud Detective</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Enquêtez sur un graphe généré dans le navigateur, inspectez les entités, signalez les liens suspects et
                  comparez votre verdict aux motifs simplifiés du jeu. Une proximité de graphe ne constitue jamais, seule,
                  une preuve de fraude.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  {[
                    { label: "Graphes", icon: Network },
                    { label: "Fraude KYB", icon: ShieldAlert },
                  ].map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1">
                      <item.icon size={13} className="text-violet" aria-hidden /> {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center gap-3 rounded-md bg-violet px-5 py-3 text-sm font-semibold text-[#04201d] transition group-hover:bg-violet/90">
                Lancer l&apos;investigation <ArrowRight size={17} aria-hidden />
              </span>
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
