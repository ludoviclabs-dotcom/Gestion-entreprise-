import { describe, it, expect } from "vitest";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeRisk } from "@/lib/risk/engine";
import {
  ADRESSE_PARTAGEE,
  CYCLE_DETENTION,
  DIRIGEANT_MULTI_SOCIETES,
  PIVOT_SUSPECT,
  PROCEDURE_COLLECTIVE,
  RADIATION,
  SOCIETE_RECENTE_TRES_LIEE,
} from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import { procedureCollectiveBundle } from "@/lib/fixtures/cases/procedure-collective";
import { reseauMultiDirigeantsBundle } from "@/lib/fixtures/cases/reseau-multi-dirigeants";
import { demoBundle } from "@/lib/fixtures/case-demo";
import { cleanCompanyBundle } from "@/lib/fixtures/cases/clean-company";
import type { CaseBundle } from "@/lib/graph/graph-types";

function evaluateRule(
  rule:
    | typeof ADRESSE_PARTAGEE
    | typeof CYCLE_DETENTION
    | typeof DIRIGEANT_MULTI_SOCIETES
    | typeof PIVOT_SUSPECT
    | typeof PROCEDURE_COLLECTIVE
    | typeof RADIATION
    | typeof SOCIETE_RECENTE_TRES_LIEE,
  bundle: CaseBundle,
) {
  const graph = buildGraph(bundle);
  return rule.evaluate({ bundle, graph, thresholds: DEFAULT_THRESHOLDS });
}

describe("règle DIRIGEANT_MULTI_SOCIETES", () => {
  it("ne déclenche pas sur un dirigeant unique d'une seule société", () => {
    const signals = evaluateRule(DIRIGEANT_MULTI_SOCIETES, cleanCompanyBundle);
    expect(signals.length).toBe(0);
  });

  it("déclenche sur un dirigeant qui en dirige >= seuil medium (3)", () => {
    const signals = evaluateRule(
      DIRIGEANT_MULTI_SOCIETES,
      reseauMultiDirigeantsBundle,
    );
    // Au moins une personne du réseau dirige >= 3 sociétés.
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(["medium", "high"]).toContain(s.severity);
      expect(s.category).toBe("complexite");
      expect(s.explanation).not.toMatch(/fraude/i);
    }
  });
});

describe("règle ADRESSE_PARTAGEE", () => {
  it("déclenche si une adresse est partagée par >= seuil medium (2)", () => {
    const signals = evaluateRule(ADRESSE_PARTAGEE, reseauMultiDirigeantsBundle);
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.category).toBe("vigilance");
    }
  });

  it("ne déclenche pas sur un dossier propre (1 adresse, 1 société)", () => {
    const signals = evaluateRule(ADRESSE_PARTAGEE, cleanCompanyBundle);
    expect(signals.length).toBe(0);
  });
});

describe("règle SOCIETE_RECENTE_TRES_LIEE", () => {
  it("respecte les seuils (12 mois + degré >= 4)", () => {
    const signals = evaluateRule(
      SOCIETE_RECENTE_TRES_LIEE,
      reseauMultiDirigeantsBundle,
    );
    for (const s of signals) {
      expect(s.severity).toBe("medium");
      expect(s.category).toBe("vigilance");
    }
  });
});

describe("règle PROCEDURE_COLLECTIVE", () => {
  it("déclenche un signal high sur un dossier avec procédure collective", () => {
    const signals = evaluateRule(PROCEDURE_COLLECTIVE, procedureCollectiveBundle);
    expect(signals.length).toBe(1);
    expect(signals[0].severity).toBe("high");
    expect(signals[0].explanation).toMatch(/Procédure collective/);
    expect(signals[0].explanation).not.toMatch(/fraude/i);
  });

  it("ne déclenche rien sur un dossier propre", () => {
    const signals = evaluateRule(PROCEDURE_COLLECTIVE, cleanCompanyBundle);
    expect(signals.length).toBe(0);
  });
});

describe("règle RADIATION", () => {
  it("ne déclenche pas sur le dossier holding démo (pas de radiation)", () => {
    const signals = evaluateRule(RADIATION, demoBundle);
    expect(signals.length).toBe(0);
  });
});

describe("règle CYCLE_DETENTION", () => {
  it("ne déclenche pas sur le dossier holding démo (chaîne arborescente)", () => {
    const signals = evaluateRule(CYCLE_DETENTION, demoBundle);
    expect(signals.length).toBe(0);
  });
});

describe("règle PIVOT_SUSPECT", () => {
  it("ne déclenche pas en dessous de 5 entités (skip explicite)", () => {
    const signals = evaluateRule(PIVOT_SUSPECT, cleanCompanyBundle);
    expect(signals.length).toBe(0);
  });

  it("peut déclencher sur un réseau dense — vocabulaire conforme", () => {
    const signals = evaluateRule(PIVOT_SUSPECT, reseauMultiDirigeantsBundle);
    // Le réseau peut ou non déclencher selon les seuils de betweenness ;
    // s'il déclenche, on valide la conformité au vocabulaire/sévérités.
    for (const s of signals) {
      expect(["medium", "high"]).toContain(s.severity);
      expect(s.category).toBe("vigilance");
      expect(s.explanation).toMatch(/centralité/);
      expect(s.explanation).not.toMatch(/fraude/i);
    }
  });
});

describe("computeRisk — vocabulaire global", () => {
  it("n'utilise jamais le mot « fraude » dans aucune explanation", () => {
    const bundles = [
      demoBundle,
      procedureCollectiveBundle,
      reseauMultiDirigeantsBundle,
      cleanCompanyBundle,
    ];
    for (const b of bundles) {
      const graph = buildGraph(b);
      const { signals } = computeRisk(b, graph);
      for (const s of signals) {
        expect(s.explanation.toLowerCase()).not.toMatch(/fraude/);
      }
    }
  });

  it("produit des scores 0-100 dans les 3 axes sur un réseau", () => {
    const graph = buildGraph(reseauMultiDirigeantsBundle);
    const { scores } = computeRisk(reseauMultiDirigeantsBundle, graph);
    expect(scores.complexite ?? -1).toBeGreaterThanOrEqual(0);
    expect(scores.complexite ?? 101).toBeLessThanOrEqual(100);
    expect(scores.vigilance ?? -1).toBeGreaterThanOrEqual(0);
    expect(scores.vigilance ?? 101).toBeLessThanOrEqual(100);
    expect(scores.qualitePreuve ?? -1).toBeGreaterThanOrEqual(0);
    expect(scores.qualitePreuve ?? 101).toBeLessThanOrEqual(100);
  });
});
