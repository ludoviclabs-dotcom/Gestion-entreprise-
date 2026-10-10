import type { CaseOrigin, CaseStatus, ScoreStatus } from "@/lib/data/types";
import type { EvidenceLevel, Severity } from "@/lib/graph/graph-types";
import type { Tone } from "./tone";

/**
 * Pont domaine → teintes. Une seule table par notion métier : toute l'UI
 * (pastilles, métriques, graphe) lit ces correspondances, jamais un hex.
 * Les libellés restent ceux du domaine (`*_LABELS`) — ce module ne parle que de teinte.
 */

/** Sévérité d'un signal. « info » est informatif, pas un risque. */
export const SEVERITY_TONE: Record<Severity, Tone> = {
  info: "info",
  low: "success",
  medium: "vigilance",
  high: "critical",
};

export const CASE_STATUS_TONE: Record<CaseStatus, Tone> = {
  draft: "neutral",
  enriching: "vigilance",
  ready: "success",
  error: "critical",
};

export const CASE_ORIGIN_TONE: Record<CaseOrigin, Tone> = {
  live: "success",
  mixed: "vigilance",
  fixture: "info",
  unknown: "neutral",
};

export const SCORE_STATUS_TONE: Record<ScoreStatus, Tone> = {
  computed: "success",
  partial: "vigilance",
  missing: "neutral",
  error: "critical",
};

/**
 * Niveau de preuve. La preuve n'est pas un risque : « confirmé » prend l'accent
 * (connexion confirmée), « inféré » la vigilance (à vérifier), « déclaré » et
 * « simulé » restent neutres — jamais rouge.
 */
export const EVIDENCE_TONE: Record<EvidenceLevel, Tone> = {
  confirmed: "accent",
  declared: "neutral",
  inferred: "vigilance",
  simulated: "neutral",
};

/**
 * Score continu 0–100 → teinte (seuils 34 / 67, ceux de ScorePills).
 * `polarity` : "risk" = plus haut est pire (complexité, vigilance) ;
 * "good" = plus haut est mieux (qualité de preuve). `undefined` → neutre.
 */
export function toneForScore(value: number | undefined, polarity: "risk" | "good"): Tone {
  if (value === undefined) return "neutral";
  if (polarity === "good") return value >= 67 ? "success" : value >= 34 ? "vigilance" : "critical";
  return value >= 67 ? "critical" : value >= 34 ? "vigilance" : "success";
}
