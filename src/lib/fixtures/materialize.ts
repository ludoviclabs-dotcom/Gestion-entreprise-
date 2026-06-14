import type { CaseBundle } from "@/lib/graph/graph-types";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeRisk } from "@/lib/risk/engine";

/**
 * Recalcule les SCORES et les SIGNAUX d'un dossier de démonstration à partir de
 * son graphe — exactement comme le chemin live `assembleCase`. Garantit qu'aucun
 * score/signal n'est écrit en dur dans les fixtures (cf. docs/audit-calculs.md) :
 * la démo affiche de vrais calculs, décomposables et traçables à leur source.
 */
export function materializeCase(bundle: CaseBundle): CaseBundle {
  const graph = buildGraph(bundle);
  const { signals, scores } = computeRisk(bundle, graph);
  return {
    ...bundle,
    riskSignals: signals,
    case: { ...bundle.case, scores },
  };
}
