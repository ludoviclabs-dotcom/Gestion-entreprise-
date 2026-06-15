import { describe, expect, it } from "vitest";
import {
  explainComplexite,
  explainQualitePreuve,
} from "@/lib/risk/engine";
import { buildGraph } from "@/lib/graph/build-graph";
import type { CaseBundle, CaseEntity, CaseEdge } from "@/lib/graph/graph-types";

function bundleOf(
  entities: CaseEntity[],
  edges: CaseEdge[] = [],
): CaseBundle {
  return {
    case: { id: "t", title: "t", rootSiren: "t" },
    entities,
    edges,
    events: [],
    riskSignals: [],
  };
}

describe("explainComplexite", () => {
  it("décompose en 3 composantes dont la somme (clampée) = le score affiché", () => {
    const bundle = bundleOf(
      [
        { id: "co:a", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "co:b", type: "company", label: "B", evidenceLevel: "confirmed" },
      ],
      [
        {
          id: "e1",
          type: "DETIENT",
          source: "co:a",
          target: "co:b",
          evidenceLevel: "declared",
        },
      ],
    );
    const exp = explainComplexite(bundle, buildGraph(bundle));
    expect(exp.components).toHaveLength(3);
    // densité = 1 lien / (2-1) entités = 1 → 1 * 22 = 22 points
    expect(exp.components[0].points).toBe(22);
    // INVARIANT clé (§2.2 audit) : le score = somme des composantes, clampée.
    const sum = exp.components.reduce((s, c) => s + c.points, 0);
    expect(exp.score).toBe(Math.min(100, Math.max(0, Math.round(sum))));
  });

  it("dossier vide → score 0, aucune composante", () => {
    const exp = explainComplexite(bundleOf([]), buildGraph(bundleOf([])));
    expect(exp.score).toBe(0);
    expect(exp.components).toHaveLength(0);
  });
});

describe("explainQualitePreuve", () => {
  it("compte par niveau de preuve et calcule la part solide", () => {
    const bundle = bundleOf(
      [
        { id: "a", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "b", type: "person", label: "B", evidenceLevel: "confirmed" },
      ],
      [
        {
          id: "e1",
          type: "DETIENT",
          source: "b",
          target: "a",
          evidenceLevel: "inferred",
        },
      ],
    );
    const exp = explainQualitePreuve(bundle);
    expect(exp.total).toBe(3);
    expect(exp.solid).toBe(2);
    expect(exp.score).toBe(67); // round(2/3 * 100)
    const confirmed = exp.counts.find((c) => c.level === "confirmed");
    const inferred = exp.counts.find((c) => c.level === "inferred");
    expect(confirmed).toMatchObject({ count: 2, solid: true });
    expect(inferred).toMatchObject({ count: 1, solid: false });
  });

  it("dossier vide → score 100 (rien d'inféré à pondérer)", () => {
    const exp = explainQualitePreuve(bundleOf([]));
    expect(exp.score).toBe(100);
    expect(exp.total).toBe(0);
  });
});
