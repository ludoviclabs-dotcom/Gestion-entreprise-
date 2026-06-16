import { describe, it, expect } from "vitest";
import { computeVigilanceProfile } from "@/lib/risk/vigilance-profile";
import type {
  CaseBundle,
  CaseRiskSignal,
  CaseEdge,
} from "@/lib/graph/graph-types";

function bundle(
  edges: CaseEdge[],
  complexite?: number,
): CaseBundle {
  return {
    case: { id: "c", title: "t", rootSiren: "0", scores: { complexite } },
    entities: [],
    edges,
    events: [],
    riskSignals: [],
  };
}

function sig(ruleId: string, severity: CaseRiskSignal["severity"]): CaseRiskSignal {
  return { id: `${ruleId}-${severity}`, ruleId, severity, category: "vigilance", explanation: "" };
}

describe("computeVigilanceProfile (V7)", () => {
  it("renvoie 3 axes étiquetés sur 0-100", () => {
    const axes = computeVigilanceProfile(bundle([], 42), []);
    expect(axes.map((a) => a.label)).toEqual(["Structure", "Sanctions", "Détention"]);
    expect(axes[0].value).toBe(42); // structure = complexité
    for (const a of axes) {
      expect(a.value).toBeGreaterThanOrEqual(0);
      expect(a.value).toBeLessThanOrEqual(100);
    }
  });

  it("dérive l'axe sanctions de la sévérité max des signaux famille sanctions", () => {
    const axes = computeVigilanceProfile(bundle([]), [
      sig("PROXIMITE_SANCTION", "high"),
      sig("CYCLE_DETENTION", "high"), // autre famille, ignorée pour cet axe
    ]);
    const sanctions = axes.find((a) => a.label === "Sanctions");
    expect(sanctions?.value).toBe(90); // high → 90
  });

  it("mesure l'opacité de détention par la part de % manquants", () => {
    const edges: CaseEdge[] = [
      { id: "e1", type: "DETIENT", source: "a", target: "b", evidenceLevel: "declared" }, // % manquant
      { id: "e2", type: "DETIENT", source: "b", target: "c", weight: "60 %", evidenceLevel: "declared" },
    ];
    const detention = computeVigilanceProfile(bundle(edges), []).find(
      (a) => a.label === "Détention",
    );
    expect(detention?.value).toBe(50); // 1 lien sur 2 sans %
  });
});
