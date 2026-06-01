import type Graph from "graphology";
import type {
  CaseBundle,
  CaseRiskSignal,
  RiskCategory,
} from "@/lib/graph/graph-types";

/** Contexte injecté à chaque règle pour l'évaluation. */
export interface RuleContext {
  bundle: CaseBundle;
  graph: Graph;
  thresholds: Thresholds;
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
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  // Person.outDegree(DIRIGE) >= medium → signal medium ; > high → high.
  dirigeantMultiSocietes: { medium: 3, high: 5 },
  // Address.inDegree(PARTAGE_ADRESSE) >= medium → medium ; > high → high.
  adressePartagee: { medium: 2, high: 5 },
  // Company.dateCreation < N mois ET degré >= K → medium.
  societeRecenteTresLiee: { months: 12, minDegree: 4 },
};
