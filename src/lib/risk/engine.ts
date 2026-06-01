import type Graph from "graphology";
import type {
  CaseBundle,
  CaseRiskSignal,
  CaseScores,
  Severity,
} from "@/lib/graph/graph-types";
import { DEFAULT_RULES } from "./rules";
import { DEFAULT_THRESHOLDS } from "./types";
import type { Rule, Thresholds } from "./types";

/** Poids appliqué à chaque sévérité dans le score de vigilance. */
const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  low: 3,
  medium: 7,
  high: 15,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Calcule le score de vigilance à partir des signaux : somme pondérée des
 * sévérités, normalisée sur 100. Cap doux à 40 pondérée → 100 (un dossier
 * sain reste largement sous 30).
 */
function computeVigilance(signals: CaseRiskSignal[]): number {
  const weighted = signals.reduce(
    (acc, s) => acc + SEVERITY_WEIGHT[s.severity],
    0,
  );
  return clamp((weighted / 40) * 100);
}

/**
 * Score de complexité structurelle : densité du graphe + degré max + nombre
 * d'entités. Calibré pour qu'un dossier solo soit < 20, un réseau dense > 70.
 */
function computeComplexite(bundle: CaseBundle, graph: Graph): number {
  const n = bundle.entities.length;
  const e = bundle.edges.length;
  if (n === 0) return 0;
  let maxDegree = 0;
  graph.forEachNode((node) => {
    const d = graph.degree(node);
    if (d > maxDegree) maxDegree = d;
  });
  const density = e / Math.max(n - 1, 1);
  // Combinaison empirique calibrée à partir des fixtures.
  const score = density * 22 + Math.log2(n + 1) * 8 + Math.log2(maxDegree + 1) * 8;
  return clamp(score);
}

/**
 * Score de qualité de preuve : % de nœuds + arêtes `confirmed|declared`
 * (vs `inferred|simulated`). Plus c'est haut, plus le dossier est fiable.
 */
function computeQualitePreuve(bundle: CaseBundle): number {
  const items: { evidenceLevel: string }[] = [
    ...bundle.entities,
    ...bundle.edges,
    ...bundle.events,
  ];
  if (items.length === 0) return 100;
  const solid = items.filter(
    (it) => it.evidenceLevel === "confirmed" || it.evidenceLevel === "declared",
  ).length;
  return clamp((solid / items.length) * 100);
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
      // eslint-disable-next-line no-console
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
