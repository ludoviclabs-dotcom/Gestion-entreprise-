import type { Transaction } from "./types";
import { benfordAnalysis, type BenfordResult } from "./benford";
import { findDuplicateTransactions, type DuplicateGroup } from "./duplicates";
import { findAmountOutliers, type AmountOutlier } from "./outliers";

export type { Transaction } from "./types";
export * from "./benford";
export * from "./duplicates";
export * from "./outliers";

export type TransactionReport = {
  count: number;
  benford: BenfordResult;
  duplicates: DuplicateGroup[];
  outliers: AmountOutlier[];
};

/**
 * Analyse transactionnelle agrégée (compute-first). N'émet aucune conclusion :
 * fournit des signaux statistiques explicables à verser au faisceau, sous
 * validation humaine. Aucune représentation de flux dans le graphe à ce stade.
 */
export function analyzeTransactions(txns: Transaction[]): TransactionReport {
  const amounts = txns.map((t) => t.amount);
  return {
    count: txns.length,
    benford: benfordAnalysis(amounts),
    duplicates: findDuplicateTransactions(txns),
    outliers: findAmountOutliers(amounts),
  };
}
