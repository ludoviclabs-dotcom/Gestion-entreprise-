import type Graph from "graphology";
import type {
  CaseBundle,
  CaseRiskSignal,
  CaseScores,
  EvidenceLevel,
  Severity,
} from "@/lib/graph/graph-types";
import { DEFAULT_RULES } from "./rules";
import { DEFAULT_THRESHOLDS } from "./types";
import type { Rule, Thresholds } from "./types";

/** Version publique du modèle de scoring utilisé dans les dossiers et exports. */
export const SCORE_MODEL_VERSION = "kyb-risk-2026.1";

/** Poids appliqué à chaque sévérité dans le score de vigilance. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  low: 3,
  medium: 7,
  high: 15,
};

/** Dénominateur de normalisation : 40 pondéré → 100 (cap doux). */
const VIGILANCE_DENOMINATOR = 40;

export type VigilanceContribution = {
  ruleId: string;
  severity: Severity;
  /** Points apportés au score de vigilance (avant cap à 100). */
  points: number;
};
export type VigilanceExplanation = {
  score: number;
  contributions: VigilanceContribution[];
  capped: boolean;
};

/**
 * Décompose le score de vigilance : contribution de chaque signal en points,
 * triée par poids décroissant. Rend le score auditable (exigence de motivation
 * des décisions de vigilance) plutôt qu'un chiffre opaque.
 */
export function explainVigilance(
  signals: CaseRiskSignal[],
): VigilanceExplanation {
  const contributions = signals
    .map((s) => ({
      ruleId: s.ruleId,
      severity: s.severity,
      points:
        Math.round(
          (SEVERITY_WEIGHT[s.severity] / VIGILANCE_DENOMINATOR) * 100 * 10,
        ) / 10,
    }))
    .sort((a, b) => b.points - a.points);
  const raw = contributions.reduce((acc, c) => acc + c.points, 0);
  return {
    score: clamp(raw),
    contributions,
    capped: raw > 100,
  };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Calcule le score de vigilance à partir des signaux : somme pondérée des
 * sévérités, normalisée sur 100. Cap doux à 40 pondérée → 100 (un dossier
 * sain reste largement sous 30).
 */
function computeVigilance(signals: CaseRiskSignal[]): number {
  // Même base que la décomposition affichée → score ↔ détail cohérents.
  return explainVigilance(signals).score;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

export type ComplexiteComponent = {
  label: string;
  detail: string;
  /** Points apportés au score de complexité (avant cap à 100). */
  points: number;
};
export type ComplexiteExplanation = {
  score: number;
  components: ComplexiteComponent[];
  capped: boolean;
};

/**
 * Décompose le score de complexité structurelle en trois composantes
 * (densité du réseau, nombre d'entités, degré maximal), chacune avec son
 * apport en points. Rend le score traçable au graphe plutôt qu'opaque.
 * Calibré pour qu'un dossier solo soit < 20, un réseau dense > 70.
 */
export function explainComplexite(
  bundle: CaseBundle,
  graph: Graph,
): ComplexiteExplanation {
  const n = bundle.entities.length;
  const e = bundle.edges.length;
  if (n === 0) return { score: 0, components: [], capped: false };

  let maxDegree = 0;
  graph.forEachNode((node) => {
    const d = graph.degree(node);
    if (d > maxDegree) maxDegree = d;
  });
  const density = e / Math.max(n - 1, 1);

  // Combinaison empirique calibrée à partir des fixtures (coefficients 22/8/8).
  const components: ComplexiteComponent[] = [
    {
      label: "Densité du réseau",
      detail: `${e} liens pour ${n} entités (densité ${round1(density)})`,
      points: round1(density * 22),
    },
    {
      label: "Nombre d'entités",
      detail: `${n} entités dans le dossier`,
      points: round1(Math.log2(n + 1) * 8),
    },
    {
      label: "Degré maximal",
      detail: `nœud le plus connecté : ${maxDegree} liens`,
      points: round1(Math.log2(maxDegree + 1) * 8),
    },
  ];
  const raw = components.reduce((acc, c) => acc + c.points, 0);
  return { score: clamp(raw), components, capped: raw > 100 };
}

function computeComplexite(bundle: CaseBundle, graph: Graph): number {
  return explainComplexite(bundle, graph).score;
}

const EVIDENCE_LEVELS: EvidenceLevel[] = [
  "confirmed",
  "declared",
  "inferred",
  "simulated",
];
const isSolidLevel = (level: EvidenceLevel): boolean =>
  level === "confirmed" || level === "declared";

export type QualitePreuveCount = {
  level: EvidenceLevel;
  count: number;
  /** Compté comme « solide » (confirmed | declared). */
  solid: boolean;
};
export type QualitePreuveExplanation = {
  score: number;
  total: number;
  solid: number;
  counts: QualitePreuveCount[];
};

/**
 * Décompose le score de qualité de preuve : répartition des nœuds + arêtes +
 * événements par niveau de preuve, et part « solide » (confirmed | declared).
 * Un dossier vide vaut 100 (rien d'inféré à pondérer).
 */
export function explainQualitePreuve(
  bundle: CaseBundle,
): QualitePreuveExplanation {
  const items: { evidenceLevel: EvidenceLevel }[] = [
    ...bundle.entities,
    ...bundle.edges,
    ...bundle.events,
  ];
  const total = items.length;
  const byLevel: Record<EvidenceLevel, number> = {
    confirmed: 0,
    declared: 0,
    inferred: 0,
    simulated: 0,
  };
  for (const it of items) byLevel[it.evidenceLevel] += 1;
  const solid = byLevel.confirmed + byLevel.declared;
  const score = total === 0 ? 100 : clamp((solid / total) * 100);
  const counts: QualitePreuveCount[] = EVIDENCE_LEVELS.map((level) => ({
    level,
    count: byLevel[level],
    solid: isSolidLevel(level),
  }));
  return { score, total, solid, counts };
}

function computeQualitePreuve(bundle: CaseBundle): number {
  return explainQualitePreuve(bundle).score;
}

export interface RiskComputationResult {
  signals: CaseRiskSignal[];
  scores: CaseScores;
}

/**
 * Évalue toutes les règles sur le bundle + son graphe, agrège les signaux,
 * et calcule les 3 scores (complexité / vigilance / qualité de preuve).
 *
 * Pure : ne modifie ni le bundle ni le graphe. Renvoie un objet neuf.
 */
export function computeRisk(
  bundle: CaseBundle,
  graph: Graph,
  options: { rules?: Rule[]; thresholds?: Thresholds } = {},
): RiskComputationResult {
  const rules = options.rules ?? DEFAULT_RULES;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const ctx = { bundle, graph, thresholds };

  const signals: CaseRiskSignal[] = [];
  for (const rule of rules) {
    try {
      signals.push(...rule.evaluate(ctx));
    } catch (error) {
      // Une règle qui plante ne doit jamais casser l'ingestion d'un dossier.
      // On préfère un score sous-évalué à une erreur 500.
      console.error(`[risk] rule ${rule.id} threw`, error);
    }
  }

  const scores: CaseScores = {
    complexite: computeComplexite(bundle, graph),
    vigilance: computeVigilance(signals),
    qualitePreuve: computeQualitePreuve(bundle),
  };

  return { signals, scores };
}
