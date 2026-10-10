import { describe, it, expect } from "vitest";
import { buildGraph, structuralDegree } from "@/lib/graph/build-graph";
import {
  LEGACY_SCORE_MODEL_VERSION,
  computeRisk,
  explainComplexite,
  scoreModelVersionOf,
  SCORE_MODEL_VERSION,
} from "@/lib/risk/engine";
import { SOCIETE_RECENTE_TRES_LIEE } from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import type { CaseBundle, CaseEvent } from "@/lib/graph/graph-types";

/**
 * La complexité décrit la STRUCTURE (dirigeants, détention, siège…), pas le
 * nombre d'annonces publiées : une société simple mais très publiée (BODACC,
 * BALO, BOAMP…) ne doit pas paraître « complexe ».
 */
function simpleCompany(events: CaseEvent[] = [], attributes: Record<string, string> = {}): CaseBundle {
  return {
    case: { id: "c", title: "SOCIETE SIMPLE", rootSiren: "552081317" },
    entities: [
      { id: "co:552081317", type: "company", label: "SOCIETE SIMPLE", evidenceLevel: "confirmed", attributes },
      { id: "pe:a", type: "person", label: "A", evidenceLevel: "declared" },
      { id: "pe:b", type: "person", label: "B", evidenceLevel: "declared" },
      { id: "ad:1", type: "address", label: "1 RUE X", evidenceLevel: "declared" },
    ],
    edges: [
      { id: "e1", type: "DIRIGE", source: "pe:a", target: "co:552081317", evidenceLevel: "declared" },
      { id: "e2", type: "DIRIGE", source: "pe:b", target: "co:552081317", evidenceLevel: "declared" },
      { id: "e3", type: "PARTAGE_ADRESSE", source: "co:552081317", target: "ad:1", evidenceLevel: "declared" },
    ],
    events,
    riskSignals: [],
  };
}

const events = (n: number): CaseEvent[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `ev:balo:${i}`,
    entityId: "co:552081317",
    kind: "annonce_financiere",
    title: `Annonce ${i}`,
    evidenceLevel: "confirmed" as const,
  }));

describe("complexité — degré structurel", () => {
  it("le degré structurel ignore les arêtes « a publié »", () => {
    const g = buildGraph(simpleCompany(events(40)));
    expect(g.degree("co:552081317")).toBe(43); // 3 liens + 40 annonces
    expect(structuralDegree(g, "co:552081317")).toBe(3);
    // Un nœud événement n'a aucun lien de structure.
    expect(structuralDegree(g, "ev:balo:0")).toBe(0);
  });

  it("50 annonces de plus ne changent PAS le score de complexité", () => {
    const none = explainComplexite(simpleCompany(), buildGraph(simpleCompany()));
    const many = explainComplexite(simpleCompany(events(50)), buildGraph(simpleCompany(events(50))));
    expect(many.maxDegree).toBe(none.maxDegree);
    expect(many.score).toBe(none.score);
    expect(many.terms).toEqual(none.terms);
  });

  it("un vrai maillage structurel, lui, augmente bien la complexité", () => {
    const base = simpleCompany();
    const bigger: CaseBundle = {
      ...base,
      entities: [
        ...base.entities,
        ...["c", "d", "e", "f", "g"].map((k) => ({
          id: `pe:${k}`,
          type: "person" as const,
          label: k.toUpperCase(),
          evidenceLevel: "declared" as const,
        })),
      ],
      edges: [
        ...base.edges,
        ...["c", "d", "e", "f", "g"].map((k) => ({
          id: `x-${k}`,
          type: "DIRIGE" as const,
          source: `pe:${k}`,
          target: "co:552081317",
          evidenceLevel: "declared" as const,
        })),
      ],
    };
    expect(explainComplexite(bigger, buildGraph(bigger)).score).toBeGreaterThan(
      explainComplexite(base, buildGraph(base)).score,
    );
  });

  it("computeRisk expose la même complexité avec ou sans annonces", () => {
    const a = simpleCompany(events(60));
    const b = simpleCompany();
    const withEvents = computeRisk(a, buildGraph(a));
    const without = computeRisk(b, buildGraph(b));
    expect(withEvents.scores.complexite).toBe(without.scores.complexite);
  });

  it("« société récente très liée » ne se déclenche pas sur le seul nombre d'annonces", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const attrs = { Création: recent.toISOString().slice(0, 10) };
    // 3 liens structurels (< seuil 4) + 30 annonces : pas « très liée ».
    const bundle = simpleCompany(events(30), attrs);
    const graph = buildGraph(bundle);
    const signals = SOCIETE_RECENTE_TRES_LIEE.evaluate({ bundle, graph, thresholds: DEFAULT_THRESHOLDS });
    expect(signals).toEqual([]);
  });

  it("le modèle de score est versionné 2026.2", () => {
    expect(SCORE_MODEL_VERSION).toBe("kyb-risk-2026.2");
    expect(LEGACY_SCORE_MODEL_VERSION).toBe("kyb-risk-2026.1");
  });

  it("explique un score PERSISTÉ avec le modèle qui l'a produit (2026.1 : annonces comptées)", () => {
    const b = simpleCompany(events(40));
    const g = buildGraph(b);
    const legacy = explainComplexite(b, g, LEGACY_SCORE_MODEL_VERSION);
    const current = explainComplexite(b, g);
    expect(legacy.maxDegree).toBe(43); // 3 liens + 40 annonces
    expect(current.maxDegree).toBe(3);
    expect(legacy.score).toBeGreaterThan(current.score);
    // Sans annonce, les deux modèles s'accordent : seule l'ancienne formule diffère.
    const bare = simpleCompany();
    expect(explainComplexite(bare, buildGraph(bare), LEGACY_SCORE_MODEL_VERSION).score).toBe(
      explainComplexite(bare, buildGraph(bare)).score,
    );
  });

  it("version persistée : lue dans les métadonnées, modèle historique à défaut", () => {
    expect(scoreModelVersionOf({ scoreModelVersion: "kyb-risk-2026.2" })).toBe("kyb-risk-2026.2");
    expect(scoreModelVersionOf({ scoreModelVersion: "kyb-risk-2026.1", origin: "live" })).toBe(
      "kyb-risk-2026.1",
    );
    for (const bad of [null, undefined, {}, { scoreModelVersion: "" }, { scoreModelVersion: 3 }, "x"]) {
      expect(scoreModelVersionOf(bad)).toBe(LEGACY_SCORE_MODEL_VERSION);
    }
  });
});
