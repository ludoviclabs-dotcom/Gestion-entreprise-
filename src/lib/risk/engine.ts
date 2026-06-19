import type Graph from "graphology";
import type {
  CaseBundle,
  CaseRiskSignal,
  CaseScores,
  EvidenceLevel,
  Severity,
} from "@/lib/graph/graph-types";
import { familyForRule } from "@/lib/graph/graph-types";
import { computeGraphMetrics } from "@/lib/graph/algorithms";
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
 * Faisceau d'indices : un signal isolé n'est jamais une alerte (§7.3, garde-fou
 * « non négociable »). On ne compte que les signaux MATÉRIELS (sévérité
 * `medium|high`), et la convergence se mesure sur des AXES DISTINCTS — le nombre
 * de FAMILLES distinctes déclenchées (`distinctFamilies`), pas le nombre brut de
 * signaux ni de règles. Ainsi plusieurs règles structurelles déclenchées par un
 * même fait (ex. relais + pivot + société récente, toutes « structure ») ne
 * sur-pondèrent pas le faisceau. Statut qualitatif — N'ALTÈRE PAS le score de
 * vigilance. À interpréter humainement, jamais en automatisme.
 */
export type FaisceauResult = {
  /** Seuil de convergence appliqué. */
  k: number;
  /** Nombre total de signaux matériels (medium|high). */
  materialCount: number;
  /** Nombre de sujets distincts visés (sociétés/personnes). */
  distinctSubjects: number;
  /** Nombre de règles distinctes déclenchées. */
  distinctRules: number;
  /** Nombre de familles distinctes déclenchées — base de la convergence. */
  distinctFamilies: number;
  /** Faisceau constitué : ≥ k familles d'indices DISTINCTES. */
  converged: boolean;
};

const MATERIAL_SEVERITIES: ReadonlySet<Severity> = new Set<Severity>([
  "medium",
  "high",
]);

export function computeConvergence(
  signals: CaseRiskSignal[],
  k = 2,
): FaisceauResult {
  const material = signals.filter((s) => MATERIAL_SEVERITIES.has(s.severity));
  const subjects = new Set(material.map((s) => s.subjectId ?? "case"));
  const rules = new Set(material.map((s) => s.ruleId));
  const families = new Set(material.map((s) => familyForRule(s.ruleId)));
  return {
    k,
    materialCount: material.length,
    distinctSubjects: subjects.size,
    distinctRules: rules.size,
    distinctFamilies: families.size,
    converged: families.size >= k,
  };
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

export type ComplexiteTerm = { label: string; points: number };
export type ComplexiteExplanation = {
  score: number;
  entities: number;
  edges: number;
  maxDegree: number;
  density: number;
  terms: ComplexiteTerm[];
};

/**
 * Décompose le score de complexité structurelle en ses 3 termes (densité,
 * taille, degré max) — rend le chiffre auditable plutôt qu'opaque. Calibré pour
 * qu'un dossier solo soit < 20, un réseau dense > 70.
 */
export function explainComplexite(
  bundle: CaseBundle,
  graph: Graph,
): ComplexiteExplanation {
  const n = bundle.entities.length;
  const e = bundle.edges.length;
  let maxDegree = 0;
  graph.forEachNode((node) => {
    const d = graph.degree(node);
    if (d > maxDegree) maxDegree = d;
  });
  const density = n === 0 ? 0 : e / Math.max(n - 1, 1);
  const tDensity = density * 22;
  const tSize = Math.log2(n + 1) * 8;
  const tDegree = Math.log2(maxDegree + 1) * 8;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  return {
    score: clamp(tDensity + tSize + tDegree),
    entities: n,
    edges: e,
    maxDegree,
    density: Math.round(density * 100) / 100,
    terms: [
      { label: "Densité du réseau", points: round1(tDensity) },
      { label: "Nombre d'entités", points: round1(tSize) },
      { label: "Degré maximal", points: round1(tDegree) },
    ],
  };
}

function computeComplexite(bundle: CaseBundle, graph: Graph): number {
  return explainComplexite(bundle, graph).score;
}

export type QualitePreuveExplanation = {
  score: number;
  total: number;
  solid: number;
  byLevel: Record<EvidenceLevel, number>;
};

/**
 * Décompose la qualité de preuve : part de nœuds + arêtes + événements
 * `confirmed|declared` (vs `inferred|simulated`), détaillée par niveau. Plus
 * c'est haut, plus le dossier est fiable.
 */
export function explainQualitePreuve(bundle: CaseBundle): QualitePreuveExplanation {
  const items = [...bundle.entities, ...bundle.edges, ...bundle.events];
  const byLevel: Record<EvidenceLevel, number> = {
    confirmed: 0,
    declared: 0,
    inferred: 0,
    simulated: 0,
  };
  for (const it of items) byLevel[it.evidenceLevel] += 1;
  const solid = byLevel.confirmed + byLevel.declared;
  const total = items.length;
  return {
    score: total === 0 ? 100 : clamp((solid / total) * 100),
    total,
    solid,
    byLevel,
  };
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
  // Métriques de graphe calculées UNE seule fois et partagées aux règles
  // structurelles (betweenness/Louvain/cycles) — évite N passes coûteuses.
  const metrics = computeGraphMetrics(graph);
  const ctx = { bundle, graph, thresholds, metrics };

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

  // P7 — niveau de preuve du SUJET de chaque signal (dérivé de l'entité visée,
  // jamais inventé). Sert la facette « Preuve du sujet », sans étiqueter le
  // signal lui-même comme confirmé.
  const evidenceBySubject = new Map<string, EvidenceLevel>(
    bundle.entities.map((e) => [e.id, e.evidenceLevel]),
  );
  for (const s of signals) {
    const lvl = s.subjectId ? evidenceBySubject.get(s.subjectId) : undefined;
    if (lvl) s.evidenceLevel = lvl;
  }

  const scores: CaseScores = {
    complexite: computeComplexite(bundle, graph),
    vigilance: computeVigilance(signals),
    qualitePreuve: computeQualitePreuve(bundle),
  };

  return { signals, scores };
}
