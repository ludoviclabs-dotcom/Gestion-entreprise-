import type { CaseStatus, CaseSummary } from "@/lib/data/types";
import type { Tone } from "@/lib/design/tone";
import { SCORE_STATUS_TONE, toneForScore } from "@/lib/design/domain-tones";
import {
  RULE_FAMILY_LABELS,
  type RuleFamily,
  type Severity,
} from "@/lib/graph/graph-types";

/**
 * Lecture « portefeuille » du tableau de bord — fonctions PURES sur les
 * `CaseSummary` déjà chargés (aucune requête supplémentaire).
 *
 * Les indicateurs reprennent À L'IDENTIQUE les calculs de l'ancienne page
 * (somme des entités, des signaux élevés, moyenne arrondie de la qualité de
 * preuve sur les seuls dossiers qui en ont une). La file de revue n'est PAS un
 * score de risque : c'est un ordre de traitement, dont chaque raison est
 * affichée en clair. Vocabulaire non accusatoire : on « instruit » un signal,
 * on ne qualifie jamais une société.
 */

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

// ── Indicateurs ────────────────────────────────────────────────────────────

export type PortfolioKpis = {
  /** Dossiers actifs (visibles après curation). */
  cases: number;
  byStatus: Record<CaseStatus, number>;
  signalsHigh: number;
  /** Dossiers portant au moins un signal de sévérité élevée. */
  casesWithHigh: number;
  /** Moyenne arrondie de la qualité de preuve (0 si aucun dossier scoré — voir `proofScored`). */
  avgProof: number;
  /** Nombre de dossiers pris en compte dans la moyenne. */
  proofScored: number;
  entities: number;
  edges: number;
};

export function computePortfolioKpis(cases: CaseSummary[]): PortfolioKpis {
  const byStatus: Record<CaseStatus, number> = { draft: 0, enriching: 0, ready: 0, error: 0 };
  for (const c of cases) byStatus[c.status] += 1;

  const withProof = cases.filter((c) => c.scores.qualitePreuve !== undefined);
  const avgProof =
    withProof.length > 0
      ? Math.round(
          withProof.reduce((n, c) => n + (c.scores.qualitePreuve ?? 0), 0) / withProof.length,
        )
      : 0;

  return {
    cases: cases.length,
    byStatus,
    signalsHigh: cases.reduce((n, c) => n + c.counts.signalsHigh, 0),
    casesWithHigh: cases.filter((c) => c.counts.signalsHigh > 0).length,
    avgProof,
    proofScored: withProof.length,
    entities: cases.reduce((n, c) => n + c.counts.entities, 0),
    edges: cases.reduce((n, c) => n + c.counts.edges, 0),
  };
}

/** Lecture qualitative d'une qualité de preuve (mêmes seuils 34 / 67 que ScorePills). */
export function proofQualityStatus(avg: number, scored: number): { tone: Tone; label: string } {
  if (scored === 0) return { tone: "neutral", label: "Aucun dossier scoré" };
  const tone = toneForScore(avg, "good");
  const label = tone === "success" ? "Bonne" : tone === "vigilance" ? "Moyenne" : "Faible";
  return { tone, label };
}

// ── File de revue ──────────────────────────────────────────────────────────

export type ReviewReasonKind =
  | "signals_high"
  | "vigilance_high"
  | "sources_failed"
  | "score_incomplete";

export type ReviewReason = { kind: ReviewReasonKind; label: string; tone: Tone };

export type ReviewItem = {
  case: CaseSummary;
  /** Raisons, de la plus prioritaire à la moins prioritaire. */
  reasons: ReviewReason[];
  /** Poids de tri (ordre de traitement, PAS un score de risque). */
  weight: number;
  /** Onglet du dossier où agir sur la raison principale. */
  href: string;
  actionLabel: string;
};

/**
 * Raisons pour lesquelles un dossier demande une revue, d'après les seules
 * données du résumé. Un dossier sans raison n'entre pas dans la file.
 *   1. signaux de sévérité élevée à instruire ;
 *   2. score de vigilance élevé (≥ 67, seuil de ScorePills) ;
 *   3. sources en échec : les conclusions reposent sur des données incomplètes ;
 *   4. scoring partiel ou manquant.
 */
export function reviewReasons(c: CaseSummary): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  const high = c.counts.signalsHigh;
  if (high > 0) {
    reasons.push({
      kind: "signals_high",
      label: `${high} ${plural(high, "signal élevé", "signaux élevés")}`,
      tone: "critical",
    });
  }
  const vigilance = c.scores.vigilance;
  if (vigilance !== undefined && toneForScore(vigilance, "risk") === "critical") {
    reasons.push({ kind: "vigilance_high", label: `Vigilance ${vigilance}/100`, tone: "critical" });
  }
  const failed = c.sourceHealth.failed;
  if (failed > 0) {
    reasons.push({
      kind: "sources_failed",
      label: `${failed} ${plural(failed, "source en échec", "sources en échec")}`,
      tone: "vigilance",
    });
  }
  if (c.scoreStatus === "partial" || c.scoreStatus === "missing") {
    reasons.push({
      kind: "score_incomplete",
      label: c.scoreStatus === "partial" ? "Score partiel" : "Score manquant",
      tone: SCORE_STATUS_TONE[c.scoreStatus],
    });
  }
  return reasons;
}

function weightOf(c: CaseSummary, reasons: ReviewReason[]): number {
  let w = 0;
  for (const r of reasons) {
    if (r.kind === "signals_high") w += 1000 + c.counts.signalsHigh * 10;
    if (r.kind === "vigilance_high") w += 500 + (c.scores.vigilance ?? 0);
    if (r.kind === "sources_failed") w += 300 + c.sourceHealth.failed * 5;
    if (r.kind === "score_incomplete") w += 100;
  }
  return w;
}

const REASON_TARGET: Record<ReviewReasonKind, { tab: string; action: string }> = {
  signals_high: { tab: "risques", action: "Ouvrir les risques" },
  vigilance_high: { tab: "risques", action: "Ouvrir les risques" },
  sources_failed: { tab: "sources", action: "Ouvrir les sources" },
  score_incomplete: { tab: "sources", action: "Ouvrir les sources" },
};

/** Dossiers à revoir, du plus prioritaire au moins prioritaire (égalité : le plus récent d'abord). */
export function buildReviewQueue(cases: CaseSummary[]): ReviewItem[] {
  return cases
    .flatMap((c) => {
      const reasons = reviewReasons(c);
      if (reasons.length === 0) return [];
      const target = REASON_TARGET[reasons[0].kind];
      return [
        {
          case: c,
          reasons,
          weight: weightOf(c, reasons),
          href: `/cases/${c.id}/${target.tab}`,
          actionLabel: target.action,
        },
      ];
    })
    .sort(
      (a, b) => b.weight - a.weight || b.case.updatedAt.localeCompare(a.case.updatedAt),
    );
}

// ── Prochaine action ───────────────────────────────────────────────────────

export type NextAction = {
  kind: "create_first" | "review" | "clear";
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: Tone;
};

export function nextAction(queue: ReviewItem[], totalCases: number): NextAction {
  if (totalCases === 0) {
    return {
      kind: "create_first",
      title: "Créer un premier dossier",
      description: "Recherchez une société par nom ou SIREN pour cartographier son réseau.",
      href: "/cases/new",
      cta: "Nouveau dossier",
      tone: "accent",
    };
  }
  const top = queue[0];
  if (!top) {
    return {
      kind: "clear",
      title: "Aucune revue en attente",
      description:
        "Aucun dossier actif ne porte de signal élevé, de source en échec ni de score incomplet.",
      href: "/cases/new",
      cta: "Nouveau dossier",
      tone: "success",
    };
  }
  const c = top.case;
  const primary = top.reasons[0];
  const title =
    primary.kind === "signals_high"
      ? `Instruire ${c.counts.signalsHigh} ${plural(c.counts.signalsHigh, "signal élevé", "signaux élevés")}`
      : primary.kind === "vigilance_high"
        ? `Examiner le score de vigilance (${c.scores.vigilance}/100)`
        : primary.kind === "sources_failed"
          ? `Vérifier ${c.sourceHealth.failed} ${plural(c.sourceHealth.failed, "source en échec", "sources en échec")}`
          : `Compléter le scoring (${primary.label.toLowerCase()})`;
  return {
    kind: "review",
    title,
    description: `${c.title} · SIREN ${c.rootSiren}`,
    href: top.href,
    cta: top.actionLabel,
    tone: primary.tone,
  };
}

// ── Signaux de sévérité élevée ─────────────────────────────────────────────

const SEVERITIES: Severity[] = ["high", "medium", "low", "info"];

export type FamilyRow = {
  family: RuleFamily;
  label: string;
  counts: Record<Severity, number>;
  total: number;
};

export type SignalsOverview = {
  totalHigh: number;
  /** Dossiers portant au moins un signal élevé (décroissant). */
  cases: { case: CaseSummary; high: number }[];
  /** Répartition famille × sévérité — seulement pour les dossiers qui la portent. */
  families: FamilyRow[];
  /** Nombre de dossiers dont la répartition par famille est connue. */
  familiesCoverage: number;
};

export function summarizeSignals(cases: CaseSummary[]): SignalsOverview {
  const withHigh = cases
    .filter((c) => c.counts.signalsHigh > 0)
    .map((c) => ({ case: c, high: c.counts.signalsHigh }))
    .sort((a, b) => b.high - a.high || a.case.title.localeCompare(b.case.title, "fr"));

  const agg = new Map<RuleFamily, Record<Severity, number>>();
  let coverage = 0;
  for (const c of cases) {
    const m = c.signalsByFamilySeverity;
    if (!m) continue;
    coverage += 1;
    for (const fam of Object.keys(m) as RuleFamily[]) {
      const row = agg.get(fam) ?? { high: 0, medium: 0, low: 0, info: 0 };
      for (const sev of SEVERITIES) row[sev] += m[fam]?.[sev] ?? 0;
      agg.set(fam, row);
    }
  }
  const families: FamilyRow[] = [...agg.entries()]
    .map(([family, counts]) => ({
      family,
      label: RULE_FAMILY_LABELS[family],
      counts,
      total: SEVERITIES.reduce((n, s) => n + counts[s], 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.counts.high - a.counts.high || b.counts.medium - a.counts.medium || b.total - a.total);

  return {
    totalHigh: withHigh.reduce((n, r) => n + r.high, 0),
    cases: withHigh,
    families,
    familiesCoverage: coverage,
  };
}

// ── Activité récente ───────────────────────────────────────────────────────

export const ACTIVITY_WINDOW_DAYS = 7;

export function recentActivity(
  cases: CaseSummary[],
  now: Date,
  limit = 6,
): { items: CaseSummary[]; updatedInWindow: number } {
  const since = now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const sorted = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    items: sorted.slice(0, limit),
    updatedInWindow: cases.filter((c) => {
      const t = Date.parse(c.updatedAt);
      return Number.isFinite(t) && t >= since && t <= now.getTime();
    }).length,
  };
}
