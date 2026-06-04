import { describe, it, expect } from "vitest";
import type { CaseBundle } from "@/lib/graph/graph-types";
import { buildGraph } from "@/lib/graph/build-graph";
import { PROXIMITE_SANCTION } from "@/lib/risk/rules";
import { explainVigilance } from "@/lib/risk/engine";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import { demoBundle } from "@/lib/fixtures/case-demo";

function ctxOf(bundle: CaseBundle) {
  return { bundle, graph: buildGraph(bundle), thresholds: DEFAULT_THRESHOLDS };
}

describe("PROXIMITE_SANCTION", () => {
  it("flag direct (1 saut) en high, indirect (2 sauts) en medium, ignore au-delà", () => {
    const bundle: CaseBundle = {
      case: { id: "t", title: "t", rootSiren: "0" },
      entities: [
        { id: "c1", type: "company", label: "C1", evidenceLevel: "confirmed" },
        { id: "c2", type: "company", label: "C2", evidenceLevel: "confirmed" },
        { id: "c3", type: "company", label: "C3", evidenceLevel: "confirmed" },
        { id: "sx", type: "sanction", label: "Sanction X", evidenceLevel: "simulated" },
      ],
      edges: [
        { id: "e0", type: "EST_VISE_PAR", source: "c1", target: "sx", evidenceLevel: "simulated" },
        { id: "e1", type: "DETIENT", source: "c1", target: "c2", weight: "100 %", evidenceLevel: "declared" },
        { id: "e2", type: "DETIENT", source: "c2", target: "c3", weight: "100 %", evidenceLevel: "declared" },
      ],
      events: [],
      riskSignals: [],
    };
    const signals = PROXIMITE_SANCTION.evaluate(ctxOf(bundle));
    const by = Object.fromEntries(signals.map((s) => [s.subjectId, s]));
    expect(by.c1.severity).toBe("high"); // 1 saut
    expect(by.c2.severity).toBe("medium"); // 2 sauts
    expect(by.c3).toBeUndefined(); // 3 sauts → hors seuil
  });

  it("ne déclenche rien sans nœud sanction", () => {
    const bundle: CaseBundle = {
      case: { id: "t", title: "t", rootSiren: "0" },
      entities: [{ id: "c1", type: "company", label: "C1", evidenceLevel: "confirmed" }],
      edges: [],
      events: [],
      riskSignals: [],
    };
    expect(PROXIMITE_SANCTION.evaluate(ctxOf(bundle))).toHaveLength(0);
  });

  it("flag la société sujet du dossier démo (reliée à un nœud sanction)", () => {
    const signals = PROXIMITE_SANCTION.evaluate(ctxOf(demoBundle));
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => !/fraude/i.test(s.explanation))).toBe(true);
  });
});

describe("explainVigilance", () => {
  const sig = (severity: "info" | "low" | "medium" | "high", ruleId = "R") => ({
    id: `${ruleId}-${severity}`,
    ruleId,
    severity,
    category: "vigilance" as const,
    explanation: "x",
  });

  it("décompose en points et trie par contribution décroissante", () => {
    const exp = explainVigilance([sig("low", "A"), sig("high", "B"), sig("medium", "C")]);
    expect(exp.contributions[0].severity).toBe("high"); // 37,5 pts en tête
    expect(exp.contributions[0].points).toBeCloseTo(37.5);
    expect(exp.contributions.at(-1)?.severity).toBe("low"); // 7,5 pts en queue
    expect(exp.score).toBe(63); // 37,5 + 17,5 + 7,5 = 62,5 → 63
    expect(exp.capped).toBe(false);
  });

  it("plafonne à 100 et marque capped", () => {
    const exp = explainVigilance(Array.from({ length: 4 }, () => sig("high")));
    expect(exp.score).toBe(100);
    expect(exp.capped).toBe(true); // 4 × 37,5 = 150 > 100
  });

  it("score 0 sans signal", () => {
    expect(explainVigilance([]).score).toBe(0);
  });
});
