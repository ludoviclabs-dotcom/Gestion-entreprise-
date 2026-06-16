import type {
  CaseBundle,
  CaseRiskSignal,
  Severity,
} from "@/lib/graph/graph-types";
import { familyForRule } from "@/lib/graph/graph-types";
import { compareDeclaredUbo, parsePct } from "@/lib/graph/ubo";

export type VigilanceAxis = { label: string; value: number };

/** Valeur 0-100 d'une sévérité de signal, pour l'axe « exposition sanctions ». */
const SEV_VAL: Record<Severity, number> = {
  info: 25,
  low: 40,
  medium: 65,
  high: 90,
};

/**
 * Profil de vigilance au niveau DOSSIER (V7) — 3 axes 0-100 RÉELLEMENT
 * calculables, non accusatoires :
 *  - Structure : score de complexité du dossier ;
 *  - Sanctions : sévérité maximale des signaux de la famille « sanctions » ;
 *  - Détention : opacité de la chaîne (part de liens DETIENT sans % exploitable,
 *    majorée si le registre UBO diverge du recalcul).
 * Pur. Les axes substance/activité/flux du référentiel ne sont PAS évalués
 * (aucune donnée) — volontairement omis plutôt que mis à 0.
 */
export function computeVigilanceProfile(
  bundle: CaseBundle,
  signals: CaseRiskSignal[],
): VigilanceAxis[] {
  const sanctions = signals
    .filter((s) => familyForRule(s.ruleId) === "sanctions")
    .reduce((m, s) => Math.max(m, SEV_VAL[s.severity]), 0);

  const detient = bundle.edges.filter((e) => e.type === "DETIENT");
  let detention =
    detient.length > 0
      ? (detient.filter((e) => parsePct(e.weight) === null).length /
          detient.length) *
        100
      : 0;
  const uboCmp = compareDeclaredUbo(bundle);
  if (uboCmp && uboCmp.divergences > 0) {
    detention = Math.min(100, detention + uboCmp.divergences * 25);
  }

  const structure = bundle.case.scores?.complexite ?? 0;

  return [
    { label: "Structure", value: structure },
    { label: "Sanctions", value: sanctions },
    { label: "Détention", value: detention },
  ];
}
