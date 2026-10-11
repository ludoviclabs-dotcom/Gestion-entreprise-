import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { CASE_STATUS_TONE, scoreGaugeTone } from "@/lib/design/domain-tones";
import { TONE_CSS_VAR, type Tone } from "@/lib/design/tone";
import { REVIEW_STATE_LABELS, type ReviewState } from "@/lib/audit/journal";
import type { CaseScores } from "@/lib/graph/graph-types";
import type { CaseOrigin, CaseStatus, ScoreStatus, SourceHealth } from "@/lib/data/types";
import { ORIGIN_LABELS, SCORE_LABELS } from "./CaseQualityBadges";
import ExportMenu from "./ExportMenu.client";
import ReviewActionBar from "./ReviewActionBar.client";

const STATUS_LABELS: Record<CaseStatus, string> = {
  draft: "Brouillon",
  enriching: "Enrichissement",
  ready: "Prêt",
  error: "Erreur",
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

const REVIEW_TONE: Record<ReviewState, Tone> = {
  a_trier: "neutral",
  en_revue: "vigilance",
  conclu: "success",
};

function Gauge({
  label,
  value,
  polarity,
  href,
  title,
  wide = false,
}: {
  label: string;
  value?: number;
  polarity: "risk" | "good";
  href?: string;
  title: string;
  wide?: boolean;
}) {
  const content = (
    <>
      <div className="whitespace-nowrap font-mono text-micro uppercase tracking-[0.1em] text-subtle">{label}</div>
      <div className="mt-[3px] flex items-baseline gap-1">
        <span className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums">{value ?? "—"}</span>
        <span className="font-mono text-micro text-subtle">/100</span>
      </div>
      <div className="relative mt-2 h-0.5 bg-border-strong">
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${value ?? 0}%`, background: TONE_CSS_VAR[scoreGaugeTone(value, polarity)] }}
        />
      </div>
    </>
  );
  const cls = wide ? "block w-[132px]" : "block w-[104px]";
  return href ? (
    <Link href={href} title={title} className={`${cls} rounded-sm transition-ui hover:opacity-80`}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

/**
 * En-tête du dossier (refonte « Registre / Nuit ») : titre, statut d'ingestion et
 * axe de revue, ligne de métadonnées en chasse fixe, trois jauges de score
 * (cliquables vers leur composition), export et action de revue principale.
 * Commun à tous les onglets du dossier.
 */
export default function CaseHeader({
  caseId,
  title,
  rootSiren,
  status,
  reviewState,
  reviewHighBand,
  counts,
  origin,
  sourceHealth,
  scoreStatus,
  updatedLabel,
  scores,
  hasSignals,
}: {
  caseId: string;
  title: string;
  rootSiren: string;
  status: CaseStatus;
  reviewState: ReviewState;
  reviewHighBand: boolean;
  counts: { entities: number; links: number; events: number };
  origin: CaseOrigin;
  sourceHealth: SourceHealth;
  scoreStatus: ScoreStatus;
  updatedLabel: string | null;
  scores: CaseScores;
  hasSignals: boolean;
}) {
  const sourceTitle = `${sourceHealth.live} live, ${sourceHealth.fixture} démo, ${sourceHealth.failed} échec(s)`;
  const meta: ReactNode[] = [
    <span key="siren">SIREN {rootSiren}</span>,
    <span key="ent">{plural(counts.entities, "entité")}</span>,
    <span key="lk">{plural(counts.links, "lien")}</span>,
    <span key="ev">{plural(counts.events, "événement")}</span>,
    <span key="origin" title={sourceTitle}>
      {ORIGIN_LABELS[origin]}
    </span>,
    <span key="score">{SCORE_LABELS[scoreStatus]}</span>,
    ...(sourceHealth.failed > 0
      ? [
          <span key="fail" className="text-tone-vigilance">
            {sourceHealth.failed}/{sourceHealth.total} sources en échec
          </span>,
        ]
      : []),
    ...(updatedLabel ? [<span key="maj">maj {updatedLabel}</span>] : []),
  ];

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-4 px-4 pt-[22px] sm:px-8">
      <div className="flex min-w-0 items-start gap-4">
        <Link
          href="/cases"
          aria-label="Retour aux dossiers"
          className="mt-0.5 grid size-8 flex-none place-items-center rounded-full border border-control text-muted-foreground transition-ui hover:border-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5">
            <h1 className="text-2xl font-semibold leading-[1.1] tracking-[-0.025em]">{title}</h1>
            <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-1.5 flex-none rounded-full"
                style={{ background: TONE_CSS_VAR[CASE_STATUS_TONE[status]] }}
              />
              <span>{STATUS_LABELS[status]}</span>
            </span>
            <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-1.5 flex-none rounded-full border-[1.5px]"
                style={{ borderColor: TONE_CSS_VAR[REVIEW_TONE[reviewState]] }}
              />
              <span>{REVIEW_STATE_LABELS[reviewState]}</span>
            </span>
          </div>
          <div className="mt-[9px] flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-subtle">
            {meta.map((item, i) => (
              <Fragment key={i}>
                {i > 0 ? <span aria-hidden>·</span> : null}
                {item}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex gap-6">
          <Gauge
            label="Complexité"
            value={scores.complexite}
            polarity="risk"
            href={`/cases/${caseId}/risques#score-complexite`}
            title="Voir la composition du score de complexité"
          />
          <Gauge
            label="Vigilance"
            value={scores.vigilance}
            polarity="risk"
            href={hasSignals ? `/cases/${caseId}/risques#score-vigilance` : undefined}
            title="Voir la composition du score de vigilance"
          />
          <Gauge
            label="Qualité de preuve"
            value={scores.qualitePreuve}
            polarity="good"
            href={`/cases/${caseId}/risques#score-qualite`}
            title="Voir la composition de la qualité de preuve"
            wide
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-[22px] gap-y-3">
          <ExportMenu caseId={caseId} />
          <ReviewActionBar caseId={caseId} state={reviewState} highBand={reviewHighBand} />
        </div>
      </div>
    </div>
  );
}
