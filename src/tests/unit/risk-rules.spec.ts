import { describe, it, expect } from "vitest";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeRisk } from "@/lib/risk/engine";
import {
  ADRESSE_PARTAGEE,
  CYCLE_DETENTION,
  DIRIGEANT_MULTI_SOCIETES,
  PROCEDURE_COLLECTIVE,
  RADIATION,
  SOCIETE_RECENTE_TRES_LIEE,
} from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import type { CaseBundle } from "@/lib/graph/graph-types";
import { reseauMultiDirigeantsBundle } from "@/lib/fixtures/cases/reseau-multi-dirigeants";
import { procedureCollectiveBundle } from "@/lib/fixtures/cases/procedure-collective";
import { cleanCompanyBundle } from "@/lib/fixtures/cases/clean-company";

function bundleOf(partial: Partial<CaseBundle>): CaseBundle {
  return {
    case: { id: "t", title: "Test", rootSiren: "000000000" },
    entities: [],
    edges: [],
    events: [],
    riskSignals: [],
    ...partial,
  };
}

describe("risk rules — unitaires", () => {
  it("DIRIGEANT_MULTI_SOCIETES déclenche à partir du seuil medium", () => {
    // 1 personne, 3 sociétés, 3 arêtes DIRIGE.
    const bundle = bundleOf({
      entities: [
        { id: "p1", type: "person", label: "X Y", evidenceLevel: "declared" },
        { id: "c1", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "c2", type: "company", label: "B", evidenceLevel: "confirmed" },
        { id: "c3", type: "company", label: "C", evidenceLevel: "confirmed" },
      ],
      edges: [
        { id: "e1", type: "DIRIGE", source: "p1", target: "c1", evidenceLevel: "declared" },
        { id: "e2", type: "DIRIGE", source: "p1", target: "c2", evidenceLevel: "declared" },
        { id: "e3", type: "DIRIGE", source: "p1", target: "c3", evidenceLevel: "declared" },
      ],
    });
    const graph = buildGraph(bundle);
    const signals = DIRIGEANT_MULTI_SOCIETES.evaluate({
      bundle,
      graph,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("medium");
    expect(signals[0].subjectId).toBe("p1");
    expect(signals[0].explanation).toContain("3 sociétés");
  });

  it("ADRESSE_PARTAGEE déclenche dès que ≥ 2 sociétés partagent une adresse", () => {
    const bundle = bundleOf({
      entities: [
        { id: "c1", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "c2", type: "company", label: "B", evidenceLevel: "confirmed" },
        { id: "a1", type: "address", label: "12 rue X", evidenceLevel: "declared" },
      ],
      edges: [
        { id: "e1", type: "PARTAGE_ADRESSE", source: "c1", target: "a1", evidenceLevel: "declared" },
        { id: "e2", type: "PARTAGE_ADRESSE", source: "c2", target: "a1", evidenceLevel: "declared" },
      ],
    });
    const graph = buildGraph(bundle);
    const signals = ADRESSE_PARTAGEE.evaluate({
      bundle,
      graph,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].subjectId).toBe("a1");
    expect(signals[0].explanation).toContain("2 sociétés");
  });

  it("PROCEDURE_COLLECTIVE déclenche un signal high par événement BODACC", () => {
    const bundle = bundleOf({
      entities: [
        { id: "c1", type: "company", label: "A", evidenceLevel: "confirmed" },
      ],
      events: [
        {
          id: "ev1",
          entityId: "c1",
          kind: "procedure_collective",
          title: "Redressement",
          occurredOn: "2025-12-01",
          evidenceLevel: "confirmed",
        },
      ],
    });
    const graph = buildGraph(bundle);
    const signals = PROCEDURE_COLLECTIVE.evaluate({
      bundle,
      graph,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("high");
    expect(signals[0].explanation).toContain("2025-12-01");
  });

  it("RADIATION déclenche un signal high par événement de radiation", () => {
    const bundle = bundleOf({
      entities: [
        { id: "c1", type: "company", label: "A", evidenceLevel: "confirmed" },
      ],
      events: [
        {
          id: "ev1",
          entityId: "c1",
          kind: "radiation",
          title: "Radiation RCS",
          occurredOn: "2026-01-15",
          evidenceLevel: "confirmed",
        },
      ],
    });
    const signals = RADIATION.evaluate({
      bundle,
      graph: buildGraph(bundle),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals[0].severity).toBe("high");
    expect(signals[0].ruleId).toBe("RADIATION");
  });

  it("CYCLE_DETENTION détecte un circuit fermé sur les arêtes DETIENT", () => {
    const bundle = bundleOf({
      entities: [
        { id: "c1", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "c2", type: "company", label: "B", evidenceLevel: "confirmed" },
        { id: "c3", type: "company", label: "C", evidenceLevel: "confirmed" },
      ],
      edges: [
        { id: "d1", type: "DETIENT", source: "c1", target: "c2", evidenceLevel: "declared" },
        { id: "d2", type: "DETIENT", source: "c2", target: "c3", evidenceLevel: "declared" },
        { id: "d3", type: "DETIENT", source: "c3", target: "c1", evidenceLevel: "declared" },
      ],
    });
    const signals = CYCLE_DETENTION.evaluate({
      bundle,
      graph: buildGraph(bundle),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("high");
    expect(signals[0].explanation).toContain("3 sociétés");
  });

  it("SOCIETE_RECENTE_TRES_LIEE ignore les vieilles sociétés ou les peu connectées", () => {
    // Société créée il y a 3 ans, degré 6 → pas de signal.
    const bundle = bundleOf({
      entities: [
        {
          id: "c1",
          type: "company",
          label: "Ancien",
          evidenceLevel: "confirmed",
          attributes: { Création: "2023-01-01" },
        },
      ],
    });
    const signals = SOCIETE_RECENTE_TRES_LIEE.evaluate({
      bundle,
      graph: buildGraph(bundle),
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(0);
  });
});

describe("computeRisk — orchestration", () => {
  it("agrège tous les signaux et calcule les 3 scores 0–100", () => {
    const graph = buildGraph(reseauMultiDirigeantsBundle);
    const { signals, scores } = computeRisk(reseauMultiDirigeantsBundle, graph);
    expect(signals.length).toBeGreaterThan(0);
    expect(scores.complexite).toBeGreaterThanOrEqual(0);
    expect(scores.complexite).toBeLessThanOrEqual(100);
    expect(scores.vigilance).toBeGreaterThanOrEqual(0);
    expect(scores.qualitePreuve).toBeGreaterThanOrEqual(0);
    // Le réseau Méridien a un dirigeant qui gère 3 sociétés et une adresse partagée.
    const ruleIds = new Set(signals.map((s) => s.ruleId));
    expect(ruleIds.has("DIRIGEANT_MULTI_SOCIETES")).toBe(true);
    expect(ruleIds.has("ADRESSE_PARTAGEE")).toBe(true);
  });

  it("détecte la procédure collective dans le bundle Atlas BTP", () => {
    const graph = buildGraph(procedureCollectiveBundle);
    const { signals } = computeRisk(procedureCollectiveBundle, graph);
    expect(signals.some((s) => s.ruleId === "PROCEDURE_COLLECTIVE")).toBe(true);
  });

  it("ne produit aucun signal vigilance sur un dossier propre", () => {
    const graph = buildGraph(cleanCompanyBundle);
    const { signals, scores } = computeRisk(cleanCompanyBundle, graph);
    expect(signals.filter((s) => s.severity === "high")).toHaveLength(0);
    expect(scores.vigilance).toBeLessThan(30);
    expect(scores.qualitePreuve).toBeGreaterThan(60);
  });
});
