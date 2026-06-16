import { describe, it, expect } from "vitest";
import { buildGraph } from "@/lib/graph/build-graph";
import {
  RELAIS_STRUCTUREL,
  CONCENTRATION_DOMICILIATION,
  CHAINE_DETENTION_OPAQUE,
  DEFAULT_RULES,
} from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import {
  RULE_FAMILY,
  countSignalsByFamilySeverity,
} from "@/lib/graph/graph-types";
import { reseauMultiDirigeantsBundle } from "@/lib/fixtures/cases/reseau-multi-dirigeants";
import type { CaseBundle, CaseEdge, CaseEntity } from "@/lib/graph/graph-types";

function bundle(entities: CaseEntity[], edges: CaseEdge[]): CaseBundle {
  return {
    case: { id: "c", title: "t", rootSiren: "000000000" },
    entities,
    edges,
    events: [],
    riskSignals: [],
  };
}

function evalRule(rule: (typeof DEFAULT_RULES)[number], b: CaseBundle) {
  const graph = buildGraph(b);
  return rule.evaluate({ bundle: b, graph, thresholds: DEFAULT_THRESHOLDS });
}

describe("CHAINE_DETENTION_OPAQUE (M9)", () => {
  it("signale une lacune de qualité de preuve (low/qualite_preuve) sur des % manquants", () => {
    const b = bundle(
      [
        { id: "co1", type: "company", label: "A", evidenceLevel: "declared" },
        { id: "co2", type: "company", label: "B", evidenceLevel: "declared" },
        { id: "co3", type: "company", label: "C", evidenceLevel: "declared" },
      ],
      [
        { id: "e1", type: "DETIENT", source: "co1", target: "co2", evidenceLevel: "declared" },
        { id: "e2", type: "DETIENT", source: "co2", target: "co3", evidenceLevel: "declared" },
      ],
    );
    const s = evalRule(CHAINE_DETENTION_OPAQUE, b);
    expect(s.length).toBe(1);
    expect(s[0].severity).toBe("low");
    expect(s[0].category).toBe("qualite_preuve");
    expect(s[0].explanation).not.toMatch(/fraude/i);
  });

  it("ne déclenche pas si les % sont exploitables", () => {
    const b = bundle(
      [
        { id: "co1", type: "company", label: "A", evidenceLevel: "declared" },
        { id: "co2", type: "company", label: "B", evidenceLevel: "declared" },
      ],
      [
        { id: "e1", type: "DETIENT", source: "co1", target: "co2", weight: "60 %", evidenceLevel: "declared" },
      ],
    );
    expect(evalRule(CHAINE_DETENTION_OPAQUE, b).length).toBe(0);
  });
});

describe("CONCENTRATION_DOMICILIATION (M9)", () => {
  it("déclenche sur une adresse partagée par ≥3 sociétés dont une récente", () => {
    const b = bundle(
      [
        { id: "adr", type: "address", label: "1 rue X", evidenceLevel: "confirmed" },
        { id: "c1", type: "company", label: "S1", evidenceLevel: "declared", attributes: { "Création": "2026-01-01" } },
        { id: "c2", type: "company", label: "S2", evidenceLevel: "declared", attributes: { "Création": "2010-01-01" } },
        { id: "c3", type: "company", label: "S3", evidenceLevel: "declared", attributes: { "Création": "2009-01-01" } },
      ],
      [
        { id: "e1", type: "PARTAGE_ADRESSE", source: "c1", target: "adr", evidenceLevel: "declared" },
        { id: "e2", type: "PARTAGE_ADRESSE", source: "c2", target: "adr", evidenceLevel: "declared" },
        { id: "e3", type: "PARTAGE_ADRESSE", source: "c3", target: "adr", evidenceLevel: "declared" },
      ],
    );
    const s = evalRule(CONCENTRATION_DOMICILIATION, b);
    expect(s.length).toBe(1);
    expect(s[0].severity).toBe("medium");
    expect(s[0].category).toBe("vigilance");
    expect(s[0].explanation).not.toMatch(/fraude/i);
  });
});

describe("RELAIS_STRUCTUREL (M9)", () => {
  it("ne déclenche pas sous 5 entités ; vocabulaire conforme sinon", () => {
    const small = bundle(
      [{ id: "co1", type: "company", label: "A", evidenceLevel: "confirmed" }],
      [],
    );
    expect(evalRule(RELAIS_STRUCTUREL, small).length).toBe(0);

    for (const sig of evalRule(RELAIS_STRUCTUREL, reseauMultiDirigeantsBundle)) {
      expect(sig.severity).toBe("medium");
      expect(sig.category).toBe("vigilance");
      expect(sig.explanation).toMatch(/relais|centralité/i);
      expect(sig.explanation).not.toMatch(/fraude/i);
    }
  });

  it("ne déclenche pas sur une société-pont à adresse NON partagée et non récente", () => {
    // B est un pont (forte centralité) mais ancienne et son adresse n'est
    // partagée par personne → aucun indice secondaire → pas de signal.
    const b = bundle(
      [
        { id: "a1", type: "person", label: "A1", evidenceLevel: "confirmed" },
        { id: "a2", type: "person", label: "A2", evidenceLevel: "confirmed" },
        { id: "B", type: "company", label: "Pont SAS", evidenceLevel: "confirmed", attributes: { "Création": "2005-01-01" } },
        { id: "c1", type: "company", label: "C1", evidenceLevel: "confirmed" },
        { id: "c2", type: "company", label: "C2", evidenceLevel: "confirmed" },
        { id: "adrB", type: "address", label: "Adresse propre", evidenceLevel: "confirmed" },
      ],
      [
        { id: "e1", type: "DIRIGE", source: "a1", target: "B", evidenceLevel: "confirmed" },
        { id: "e2", type: "DIRIGE", source: "a2", target: "B", evidenceLevel: "confirmed" },
        { id: "e3", type: "DETIENT", source: "B", target: "c1", weight: "60 %", evidenceLevel: "confirmed" },
        { id: "e4", type: "DETIENT", source: "B", target: "c2", weight: "60 %", evidenceLevel: "confirmed" },
        { id: "e5", type: "PARTAGE_ADRESSE", source: "B", target: "adrB", evidenceLevel: "confirmed" },
      ],
    );
    expect(evalRule(RELAIS_STRUCTUREL, b).length).toBe(0);
  });
});

describe("intégrité du catalogue", () => {
  it("toute règle de DEFAULT_RULES a une famille (facettes cohérentes)", () => {
    for (const r of DEFAULT_RULES) {
      expect(RULE_FAMILY[r.id], `famille manquante pour ${r.id}`).toBeDefined();
    }
  });

  it("countSignalsByFamilySeverity agrège famille × sévérité (V9)", () => {
    const counts = countSignalsByFamilySeverity([
      { ruleId: "PROXIMITE_SANCTION", severity: "high" },
      { ruleId: "PROXIMITE_SANCTION", severity: "medium" },
      { ruleId: "CYCLE_DETENTION", severity: "high" },
    ]);
    expect(counts.sanctions?.high).toBe(1);
    expect(counts.sanctions?.medium).toBe(1);
    expect(counts.capital?.high).toBe(1);
  });
});
