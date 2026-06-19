import { describe, it, expect } from "vitest";
import {
  computeCapitalOpacity,
  computeCrossBorderExposure,
  computeDomiciliationConcentration,
} from "@/lib/risk/indicators";
import { explainComplexite, explainQualitePreuve } from "@/lib/risk/engine";
import { COUVERTURE_MEDIA_DEFAVORABLE } from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import { buildGraph } from "@/lib/graph/build-graph";
import type { CaseBundle, CaseEvent } from "@/lib/graph/graph-types";

function bundleOf(partial: Partial<CaseBundle>): CaseBundle {
  return {
    case: { id: "x", title: "X", rootSiren: "111222333" },
    entities: [],
    edges: [],
    events: [],
    riskSignals: [],
    ...partial,
  };
}

describe("indicateurs structurels", () => {
  it("opacité capitalistique = liens DETIENT sans % / total", () => {
    const b = bundleOf({
      edges: [
        { id: "1", type: "DETIENT", source: "a", target: "b", weight: "60 %", evidenceLevel: "declared" },
        { id: "2", type: "DETIENT", source: "c", target: "b", evidenceLevel: "declared" },
        { id: "3", type: "DIRIGE", source: "p", target: "b", evidenceLevel: "declared" },
      ],
    });
    const o = computeCapitalOpacity(b);
    expect(o.total).toBe(2);
    expect(o.missing).toBe(1);
    expect(o.ratio).toBe(0.5);
  });

  it("exposition transfrontalière compte les pays étrangers (hors FR)", () => {
    const b = bundleOf({
      entities: [
        { id: "co:1", type: "company", label: "SUJET", evidenceLevel: "confirmed", attributes: { SIREN: "111222333" } },
        { id: "co:lei:1", type: "company", label: "MERE LU", evidenceLevel: "declared", attributes: { Pays: "LU" } },
        { id: "co:lei:2", type: "company", label: "MERE US", evidenceLevel: "declared", attributes: { Pays: "US" } },
      ],
    });
    const x = computeCrossBorderExposure(b);
    expect(x.count).toBe(2);
    expect(x.countries).toEqual(["LU", "US"]);
    expect(x.hasNonEu).toBe(true);
  });

  it("concentration domiciliation = degré entrant max sur une adresse", () => {
    const b = bundleOf({
      entities: [{ id: "ad:x", type: "address", label: "17 BD HAUSSMANN", evidenceLevel: "declared" }],
      edges: [
        { id: "1", type: "PARTAGE_ADRESSE", source: "co:1", target: "ad:x", evidenceLevel: "declared" },
        { id: "2", type: "PARTAGE_ADRESSE", source: "co:2", target: "ad:x", evidenceLevel: "declared" },
      ],
    });
    const d = computeDomiciliationConcentration(b);
    expect(d.maxDegree).toBe(2);
    expect(d.addressId).toBe("ad:x");
    expect(d.addressLabel).toBe("17 BD HAUSSMANN");
  });
});

describe("décomposition des scores", () => {
  it("explainComplexite expose les 3 termes", () => {
    const b = bundleOf({
      entities: [
        { id: "a", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "b", type: "person", label: "B", evidenceLevel: "declared" },
      ],
      edges: [{ id: "1", type: "DIRIGE", source: "b", target: "a", evidenceLevel: "declared" }],
    });
    const e = explainComplexite(b, buildGraph(b));
    expect(e.entities).toBe(2);
    expect(e.terms).toHaveLength(3);
    expect(e.score).toBeGreaterThanOrEqual(0);
  });

  it("explainQualitePreuve = part confirmed|declared", () => {
    const b = bundleOf({
      entities: [
        { id: "a", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "b", type: "company", label: "B", evidenceLevel: "inferred" },
      ],
    });
    const q = explainQualitePreuve(b);
    expect(q.total).toBe(2);
    expect(q.solid).toBe(1);
    expect(q.score).toBe(50);
    expect(q.byLevel.confirmed).toBe(1);
    expect(q.byLevel.inferred).toBe(1);
  });
});

describe("règle COUVERTURE_MEDIA_DEFAVORABLE", () => {
  const ctxOf = (events: CaseEvent[]) => {
    const bundle = bundleOf({ events });
    return { bundle, graph: buildGraph(bundle), thresholds: DEFAULT_THRESHOLDS };
  };
  const mediaEvent = (kind: string, i: number): CaseEvent => ({
    id: `e${i}`,
    entityId: "co:1",
    kind,
    title: "x",
    evidenceLevel: "inferred",
  });

  it("déclenche au seuil d'articles défavorables", () => {
    const signals = COUVERTURE_MEDIA_DEFAVORABLE.evaluate(
      ctxOf([mediaEvent("couverture_media_defavorable", 1), mediaEvent("couverture_media_defavorable", 2)]),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].subjectId).toBe("co:1");
    expect(signals[0].severity).toBe("medium");
  });

  it("ne déclenche pas sous le seuil ni sur de la presse neutre", () => {
    expect(
      COUVERTURE_MEDIA_DEFAVORABLE.evaluate(ctxOf([mediaEvent("couverture_media_defavorable", 1)])),
    ).toHaveLength(0);
    expect(
      COUVERTURE_MEDIA_DEFAVORABLE.evaluate(
        ctxOf([mediaEvent("couverture_media", 1), mediaEvent("couverture_media", 2)]),
      ),
    ).toHaveLength(0);
  });
});
