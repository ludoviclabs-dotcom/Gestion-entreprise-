import type Graph from "graphology";
import type {
  CaseBundle,
  CaseRiskSignal,
  RiskCategory,
} from "@/lib/graph/graph-types";
import type { GraphMetrics } from "@/lib/graph/algorithms";

/** Contexte injecté à chaque règle pour l'évaluation. */
export interface RuleContext {
  bundle: CaseBundle;
  graph: Graph;
  thresholds: Thresholds;
  /**
   * Métriques de graphe précalculées UNE fois par `computeRisk` (betweenness,
   * communautés, cycles). Optionnel : une règle évaluée isolément (tests) peut
   * les recalculer via `computeGraphMetrics(ctx.graph)`. Évite N passes
   * betweenness/Louvain quand plusieurs règles structurelles s'exécutent.
   */
  metrics?: GraphMetrics;
}

/** Contrat d'une règle : pure, déterministe, explicable. */
export interface Rule {
  id: string;
  label: string;
  category: RiskCategory;
  evaluate(ctx: RuleContext): CaseRiskSignal[];
}

/**
 * Seuils centralisés des règles.
 * Documentés dans `docs/risk-rules.md` ; modifiables sans toucher au code des
 * règles individuelles.
 */
export interface Thresholds {
  dirigeantMultiSocietes: { medium: number; high: number };
  adressePartagee: { medium: number; high: number };
  societeRecenteTresLiee: { months: number; minDegree: number };
  /** Faisceau d'indices : nb minimal de familles d'indices convergentes (§7.3). */
  convergence: { k: number };
  // ── Typologies structurelles (M9) ──
  /** Relais : centralité minimale + fenêtre de « récence » (mois). */
  relaisStructurel: { betweenness: number; recentMonths: number };
  /** Domiciliation concentrée : nb min de sociétés + fenêtre de récence (mois). */
  concentrationDomiciliation: { minCompanies: number; recentMonths: number };
  /** Chaîne opaque : nb min de liens DETIENT sans % exploitable. */
  chaineDetentionOpaque: { minMissing: number };
  /** Presse défavorable : nb min d'articles à tonalité négative par entité. */
  couvertureMedia: { minAdverse: number };
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  // Person.outDegree(DIRIGE) >= medium → signal medium ; > high → high.
  dirigeantMultiSocietes: { medium: 3, high: 5 },
  // Address.inDegree(PARTAGE_ADRESSE) >= medium → medium ; > high → high.
  adressePartagee: { medium: 2, high: 5 },
  // Company.dateCreation < N mois ET degré >= K → medium.
  societeRecenteTresLiee: { months: 12, minDegree: 4 },
  // Aucune alerte sur un signal isolé : faisceau constitué à partir de k familles
  // d'indices distinctes (sévérité medium|high). Garde-fou « non négociable ».
  convergence: { k: 2 },
  relaisStructurel: { betweenness: 0.35, recentMonths: 18 },
  concentrationDomiciliation: { minCompanies: 3, recentMonths: 24 },
  chaineDetentionOpaque: { minMissing: 2 },
  // Presse seule jamais alarmante : ce signal n'alerte qu'en faisceau (≥ 2 familles).
  couvertureMedia: { minAdverse: 2 },
};
