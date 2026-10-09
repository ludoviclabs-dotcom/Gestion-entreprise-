import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ExternalLink,
  Eye,
  Lock,
  Target,
  Users,
} from "lucide-react";
import type { LearningPath, Notion } from "@/lib/learning/schema";
import { PRIMARY_SOURCE_KINDS } from "@/lib/learning/schema";
import { getSource } from "@/lib/learning/sources";
import { CLAIM_NATURE_LABELS, SOURCE_KIND_LABELS } from "@/lib/learning/labels";
import { FictionBanner } from "./FictionBanner";

function frDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function NotionCard({ notion }: { notion: Notion }) {
  const sources = notion.sourceIds.map((id) => getSource(id)).filter((s) => s !== undefined);
  return (
    <article
      id={`notion-${notion.id}`}
      className="flex flex-col rounded-lg border border-border bg-surface p-5"
    >
      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
        {notion.term}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{notion.definition}</p>
      {notion.caution ? (
        <p className="mt-3 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-xs leading-5 text-foreground">
          <span className="font-semibold text-amber-700 dark:text-amber">À ne pas conclure : </span>
          {notion.caution}
        </p>
      ) : null}
      <div className="mt-auto pt-4">
        {sources.length > 0 ? (
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1 text-foreground underline decoration-border underline-offset-2 hover:decoration-violet"
                  title={s.limits ? `${s.supports} Limite : ${s.limits}` : s.supports}
                >
                  <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    {s.publisher} — {s.title}
                  </span>
                </a>
                <span className="ml-4 block text-muted-foreground">
                  {SOURCE_KIND_LABELS[s.kind]}
                  {PRIMARY_SOURCE_KINDS.includes(s.kind) ? " · source primaire" : ""}
                  {" · consulté le "}
                  {frDate(s.consultedOn)}
                  {" · "}
                  <Link
                    href={`/lab/sources#source-${s.id}`}
                    className="underline decoration-border underline-offset-2 hover:decoration-violet"
                  >
                    fiche<span className="sr-only"> de la source {s.title}</span>
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Définition pédagogique propre au Lab.</p>
        )}
        {notion.appliesFrom ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Applicable depuis le {frDate(notion.appliesFrom)}.
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Page d'introduction d'un parcours guidé : objectifs, démonstrateur fictif,
 * vues, statuts d'affirmation et notions sourcées. Composant serveur.
 */
export function LearningPathIntro({ path }: { path: LearningPath }) {
  const available = path.status === "disponible";
  return (
    <>
      <FictionBanner />
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-surface px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft size={15} /> Lab
            </Link>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-violet">
              Parcours guidé
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold sm:text-4xl">
              {path.title}
            </h1>
            <p className="mt-3 max-w-3xl text-lg leading-8 text-foreground">{path.question}</p>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{path.intro}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <Clock size={13} aria-hidden /> Environ {path.durationMinutes} min
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <BookOpen size={13} aria-hidden /> {path.notions.length} notions sourcées
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <Eye size={13} aria-hidden /> {path.views.length} vues coordonnées
              </span>
            </div>
          </div>
        </header>

        <section className="px-6 py-10" aria-labelledby="objectifs">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-border bg-surface p-6">
              <h2 id="objectifs" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-semibold">
                <Target size={18} className="text-violet" aria-hidden /> Ce que vous saurez faire
              </h2>
              <ul className="mt-4 space-y-2.5 text-sm leading-6">
                {path.objectives.map((o) => (
                  <li key={o} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" aria-hidden />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-surface p-6">
              <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-semibold">
                <Users size={18} className="text-violet" aria-hidden /> Pour qui
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {path.audience.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Aucune connaissance spécialisée n'est requise. Une analyse réussie peut conclure que
                l'information disponible ne permet pas de trancher.
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 pb-10" aria-labelledby="demonstrateur">
          <div className="mx-auto max-w-6xl rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Démonstrateur fictif
                </p>
                <h2 id="demonstrateur" className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                  {path.scenarioTitle}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{path.scenarioSummary}</p>
              </div>
              {available ? (
                <Link
                  href={`/lab/${path.slug}/scenario`}
                  className="inline-flex items-center gap-2 rounded-md bg-violet px-5 py-3 text-sm font-semibold text-[#04201d]"
                >
                  Commencer le scénario
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium text-muted-foreground"
                >
                  <Lock size={15} aria-hidden /> Scénario jouable en préparation
                </span>
              )}
            </div>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {path.outline.map((step, i) => (
                <li key={step.title} className="rounded-md border border-border bg-background/40 p-4">
                  <p className="text-xs font-semibold text-violet">Étape {i + 1}</p>
                  <p className="mt-1 text-sm font-semibold">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-6 pb-10" aria-labelledby="vues">
          <div className="mx-auto max-w-6xl">
            <h2 id="vues" className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Chaque vue répond à une question
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {path.views.map((v) => (
                <div key={v.title} className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm font-semibold">{v.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{v.question}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-10" aria-labelledby="statuts">
          <div className="mx-auto max-w-6xl">
            <h2 id="statuts" className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Lire une affirmation
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Chaque élément du scénario porte un statut. Aucune couleur ni aucune position dans le graphe
              ne transforme une hypothèse en fait.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.values(CLAIM_NATURE_LABELS).map((c) => (
                <div key={c.label} className="rounded-lg border border-border bg-surface p-4">
                  <dt className="text-sm font-semibold">{c.label}</dt>
                  <dd className="mt-1 text-xs leading-5 text-muted-foreground">{c.hint}</dd>
                  <dd className="mt-2 border-l-2 border-border pl-2 text-xs italic leading-5 text-muted-foreground">
                    {c.example}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="px-6 pb-16" aria-labelledby="notions">
          <div className="mx-auto max-w-6xl">
            <h2 id="notions" className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Notions et sources
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Les textes et publications d'autorités établissent ; la presse et les études orientent une
              recherche. Relisez toujours la version consolidée d'un texte avant de l'appliquer. Dates,
              limites et rythme de revue de chaque source :{" "}
              <Link href="/lab/sources" className="text-foreground underline decoration-border underline-offset-2 hover:decoration-violet">
                fiches sources
              </Link>
              .
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {path.notions.map((n) => (
                <NotionCard key={n.id} notion={n} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
