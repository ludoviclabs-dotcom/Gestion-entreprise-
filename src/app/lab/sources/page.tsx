import Link from "next/link";
import { ArrowLeft, CalendarClock, ExternalLink, FileText, Scale } from "lucide-react";
import { PublicFooter } from "@/components/site/PublicFooter";
import { PRIMARY_SOURCE_KINDS, type SourceKind, type SourceRecord } from "@/lib/learning/schema";
import { LEARNING_PATHS } from "@/lib/learning/paths";
import { LEARNING_SOURCES, nextReviewDate, reviewCadence, sourceUses } from "@/lib/learning/sources";
import { frDate, frPartialDate } from "@/lib/learning/projections";

export const metadata = {
  title: "Fiches sources — Lab KYB Graph",
  description:
    "Sources réelles citées par les parcours du Lab : ce que chacune permet d'affirmer, ses limites, sa date de consultation et sa prochaine revue.",
};

const GROUPS: { kind: SourceKind; title: string }[] = [
  { kind: "texte_officiel", title: "Textes officiels" },
  { kind: "publication_autorite", title: "Publications d'autorités" },
  { kind: "guide", title: "Guides officiels" },
  { kind: "documentation_technique", title: "Documentation technique" },
  { kind: "etude", title: "Études (sources secondaires)" },
  { kind: "presse", title: "Presse (sources secondaires)" },
];

function SourceSheet({ source, uses }: { source: SourceRecord; uses: ReturnType<typeof sourceUses> }) {
  const primary = PRIMARY_SOURCE_KINDS.includes(source.kind);
  const usedBy = uses.get(source.id) ?? [];
  return (
    <article id={`source-${source.id}`} className="flex scroll-mt-16 flex-col rounded-lg border border-border bg-surface p-5">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{source.publisher}</span>
        <span className="rounded-full border border-border px-2 py-0.5">
          {primary ? "Source primaire" : "Source secondaire"}
        </span>
      </p>
      <h3 className="mt-2 text-base font-semibold leading-6">
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-2 hover:decoration-violet"
          >
            {source.title}
            <ExternalLink size={13} className="ml-1 inline align-baseline" aria-label="(nouvel onglet)" />
          </a>
        ) : (
          source.title
        )}
      </h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Publication</dt>
        <dd>{source.published ? frPartialDate(source.published) : "non indiquée"}</dd>
        <dt className="text-muted-foreground">Consultée le</dt>
        <dd>{frDate(source.consultedOn)}</dd>
        <dt className="text-muted-foreground">Revue</dt>
        <dd>
          {reviewCadence(source)}, à relire avant le {frDate(nextReviewDate(source))}
        </dd>
      </dl>
      <p className="mt-3 text-sm leading-6">
        <span className="font-semibold">Ce qu&apos;elle permet d&apos;affirmer : </span>
        {source.supports}
      </p>
      {source.limits ? (
        <p className="mt-2 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-xs leading-5">
          <span className="font-semibold text-amber-700 dark:text-amber">Limites : </span>
          {source.limits}
        </p>
      ) : null}
      <div className="mt-auto pt-3 text-xs text-muted-foreground">
        {usedBy.length > 0 ? (
          <>
            Citée par :{" "}
            {usedBy.map((u, i) => (
              <span key={`${u.pathSlug}-${u.notionId}`}>
                {i > 0 ? " ; " : ""}
                <Link
                  href={`/lab/${u.pathSlug}#notion-${u.notionId}`}
                  className="text-foreground underline decoration-border underline-offset-2 hover:decoration-violet"
                >
                  {u.term}
                </Link>{" "}
                ({u.pathTitle})
              </span>
            ))}
          </>
        ) : (
          "Citée par le cadrage, sans notion de parcours rattachée."
        )}
      </div>
    </article>
  );
}

/**
 * Fiches sources du Lab (cadrage §2.3) : chaque source réelle avec ce qu'elle
 * permet d'affirmer, ses limites, ses dates et son rythme de revue.
 */
export default function LabSourcesPage() {
  const sources: SourceRecord[] = Object.values(LEARNING_SOURCES);
  const uses = sourceUses(LEARNING_PATHS);
  const primaryCount = sources.filter((s) => PRIMARY_SOURCE_KINDS.includes(s.kind)).length;
  const consulted = [...new Set(sources.map((s) => s.consultedOn))].sort();

  return (
    <>
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-surface px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft size={15} /> Lab
            </Link>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-violet">Lab KYB</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold sm:text-4xl">
              Fiches sources
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Les scénarios sont fictifs ; les notions qui les éclairent s&apos;appuient sur des sources réelles. Chaque
              fiche dit ce que la source permet d&apos;affirmer, jusqu&apos;où elle a été lue et quand la relire. Une
              fiche oriente : elle ne remplace pas la lecture du texte consolidé.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <FileText size={13} aria-hidden /> {sources.length} fiches,{" "}
                {primaryCount === sources.length ? "toutes de sources primaires" : `dont ${primaryCount} de sources primaires`}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                <CalendarClock size={13} aria-hidden /> Consultées le {consulted.map(frDate).join(", ")}
              </span>
            </div>
          </div>
        </header>

        <section className="px-6 py-10" aria-labelledby="politique">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 id="politique" className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-semibold">
                <Scale size={18} className="text-violet" aria-hidden /> Politique documentaire
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-6">
                <li>Les textes officiels et les publications d&apos;autorités établissent une règle ou un constat publié.</li>
                <li>
                  La presse et les études de cabinets orientent une recherche ou illustrent un contexte ; elles ne
                  confirment pas un fait. Le registre n&apos;en cite aucune à ce jour.
                </li>
                <li>Deux reprises d&apos;une même publication ne font pas deux confirmations indépendantes.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-semibold">
                <CalendarClock size={18} className="text-violet" aria-hidden /> Rythme de revue
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-6">
                <li>Trimestrielle pour les textes et les publications réglementaires.</li>
                <li>Mensuelle pour la veille des publications de risque (GAFI, Tracfin, DGSI).</li>
                <li>Annuelle pour les guides et la documentation technique stables.</li>
              </ul>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Règle éditoriale proposée par le cadrage, pas obligation légale. Une modification identifiée d&apos;un
                texte déclenche une revue sans attendre l&apos;échéance.
              </p>
            </div>
          </div>
        </section>

        {GROUPS.map(({ kind, title }) => {
          const group = sources.filter((s) => s.kind === kind);
          if (group.length === 0) return null;
          return (
            <section key={kind} className="px-6 pb-10" aria-labelledby={`groupe-${kind}`}>
              <div className="mx-auto max-w-6xl">
                <h2 id={`groupe-${kind}`} className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  {title}
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {group.map((s) => (
                    <SourceSheet key={s.id} source={s} uses={uses} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </main>
      <PublicFooter />
    </>
  );
}
