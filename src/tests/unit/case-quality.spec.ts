import { describe, expect, it } from "vitest";
import {
  buildBundleEvidence,
  getScoreStatus,
  getSourceHealth,
} from "@/lib/data/case-quality";
import type { CaseBundle } from "@/lib/graph/graph-types";
import type { SourceRow } from "@/lib/data/types";

const bundle: CaseBundle = {
  case: {
    id: "quality-demo",
    title: "Quality Demo",
    rootSiren: "123456789",
    scores: { complexite: 42, vigilance: 18, qualitePreuve: 91 },
  },
  entities: [
    {
      id: "c1",
      type: "company",
      label: "ALPHA",
      evidenceLevel: "confirmed",
      source: "Sirene",
    },
    {
      id: "p1",
      type: "person",
      label: "Marie MARTIN",
      evidenceLevel: "declared",
      source: "INPI / RNE",
    },
  ],
  edges: [
    {
      id: "e1",
      type: "DIRIGE",
      source: "p1",
      target: "c1",
      evidenceLevel: "declared",
      label: "preside",
      sourceLabel: "INPI / RNE",
    },
  ],
  events: [
    {
      id: "ev1",
      entityId: "c1",
      kind: "creation",
      title: "Immatriculation BODACC",
      evidenceLevel: "confirmed",
      source: "BODACC",
    },
  ],
  riskSignals: [
    {
      id: "r1",
      ruleId: "ECART_UBO_DECLARE",
      severity: "high",
      category: "vigilance",
      explanation: "Ecart de beneficiaire effectif a revoir.",
    },
  ],
};

const sources: SourceRow[] = [
  { source: "sirene", endpoint: "fixture:sirene", httpStatus: 0, isFixture: true },
  { source: "inpi", endpoint: "fixture:inpi", httpStatus: 0, isFixture: true },
  { source: "bodacc", endpoint: "fixture:bodacc", httpStatus: 0, isFixture: true },
];

describe("case quality", () => {
  it("calcule l'origine live, mixed ou fixture", () => {
    expect(getSourceHealth(sources).origin).toBe("fixture");
    expect(
      getSourceHealth([
        { source: "sirene", endpoint: "live", httpStatus: 200, isFixture: false },
      ]).origin,
    ).toBe("live");
    expect(
      getSourceHealth([
        sources[0],
        { source: "bodacc", endpoint: "live", httpStatus: 503, isFixture: false },
      ]),
    ).toMatchObject({ origin: "mixed", failed: 1 });
  });

  it("classe l'etat de score", () => {
    expect(getScoreStatus(bundle.case.scores ?? {})).toBe("computed");
    expect(getScoreStatus({ vigilance: 20 })).toBe("partial");
    expect(getScoreStatus({})).toBe("missing");
    expect(getScoreStatus({}, "error")).toBe("error");
  });

  it("construit les preuves par entite, lien, evenement et signal", () => {
    const evidence = buildBundleEvidence(bundle, sources);
    expect(evidence).toHaveLength(5);
    expect(evidence.find((item) => item.subjectId === "c1")).toMatchObject({
      subjectType: "entity",
      source: "sirene",
      level: "confirmed",
    });
    expect(evidence.find((item) => item.subjectId === "e1")).toMatchObject({
      subjectType: "edge",
      source: "inpi",
      level: "declared",
    });
    expect(evidence.find((item) => item.subjectId === "r1")).toMatchObject({
      subjectType: "risk_signal",
      source: "inpi",
      level: "inferred",
    });
  });
});
