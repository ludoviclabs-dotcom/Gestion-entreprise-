import { describe, it, expect } from "vitest";
import { computeConvergence } from "@/lib/risk/engine";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";
import { familyForRule } from "@/lib/graph/graph-types";
import type {
  CaseBundle,
  CaseRiskSignal,
  Severity,
} from "@/lib/graph/graph-types";

function sig(
  severity: Severity,
  subjectId?: string,
  ruleId = "TEST_RULE",
): CaseRiskSignal {
  return {
    id: `${ruleId}-${severity}-${subjectId ?? "case"}-${Math.random()}`,
    ruleId,
    subjectId,
    severity,
    category: "vigilance",
    explanation: "",
  };
}

// ── Faisceau d'indices (M10 / P6) ────────────────────────────────────────

describe("computeConvergence — faisceau d'indices", () => {
  it("ne constitue jamais un faisceau sur un signal isolé", () => {
    const r = computeConvergence([sig("medium")], 2);
    expect(r.materialCount).toBe(1);
    expect(r.distinctFamilies).toBe(1);
    expect(r.converged).toBe(false);
  });

  it("ignore les signaux non matériels (info/low)", () => {
    const r = computeConvergence([sig("low"), sig("info"), sig("low")], 2);
    expect(r.materialCount).toBe(0);
    expect(r.converged).toBe(false);
  });

  it("constitue un faisceau à partir de k FAMILLES distinctes", () => {
    const r = computeConvergence(
      [
        sig("medium", "a", "PROXIMITE_SANCTION"), // famille sanctions
        sig("high", "b", "CYCLE_DETENTION"), // famille capital
      ],
      2,
    );
    expect(r.distinctFamilies).toBe(2);
    expect(r.converged).toBe(true);
  });

  it("ne constitue PAS un faisceau sur des signaux d'une même règle (anti-doublon)", () => {
    // Deux signaux de la même règle (ex. deux procédures sur la même société) :
    // matériels mais 1 seule famille → pas de faisceau (garde-fou signal isolé).
    const r = computeConvergence(
      [
        sig("high", "a", "PROXIMITE_SANCTION"),
        sig("high", "b", "PROXIMITE_SANCTION"),
      ],
      2,
    );
    expect(r.materialCount).toBe(2);
    expect(r.distinctRules).toBe(1);
    expect(r.distinctFamilies).toBe(1);
    expect(r.converged).toBe(false);
  });

  it("ne constitue PAS un faisceau sur deux règles d'une MÊME famille (dédup par famille)", () => {
    // PROCEDURE_COLLECTIVE et RADIATION sont 2 règles mais 1 même angle (« evenement »).
    const r = computeConvergence(
      [
        sig("high", "a", "PROCEDURE_COLLECTIVE"),
        sig("high", "b", "RADIATION"),
      ],
      2,
    );
    expect(r.distinctRules).toBe(2);
    expect(r.distinctFamilies).toBe(1);
    expect(r.converged).toBe(false);
  });

  it("compte les sujets distincts visés", () => {
    const r = computeConvergence(
      [
        sig("high", "a", "PROXIMITE_SANCTION"),
        sig("medium", "b", "CYCLE_DETENTION"),
      ],
      2,
    );
    expect(r.distinctSubjects).toBe(2);
  });

  it("sur dossier vide : rien à escalader", () => {
    const r = computeConvergence([], 2);
    expect(r.materialCount).toBe(0);
    expect(r.distinctFamilies).toBe(0);
    expect(r.converged).toBe(false);
    expect(r.distinctSubjects).toBe(0);
  });
});

// ── Facteurs atténuants (P8) ──────────────────────────────────────────────

const NOW = new Date(Date.UTC(2026, 0, 1));
const KNOWN_FACTOR_IDS = new Set([
  "UBO_CONCORDANT",
  "PREUVE_SOLIDE",
  "AUCUNE_ENTITE_SIGNALEE",
  "PAS_DE_PROCEDURE",
  "ANCIENNETE_ETABLIE",
  "TVA_INTRACOM_ACTIVE",
]);

function baseBundle(): CaseBundle {
  return {
    case: { id: "c1", title: "Test", rootSiren: "812 345 678" },
    entities: [
      {
        id: "co1",
        type: "company",
        label: "ACME SAS",
        evidenceLevel: "confirmed",
        attributes: { SIREN: "812345678", Création: "2010-01-01" },
      },
    ],
    edges: [],
    events: [],
    riskSignals: [],
  };
}

describe("computeMitigatingFactors — garde-fou faux positifs", () => {
  it("émet des facteurs dérivables et un vocabulaire non accusatoire", () => {
    const factors = computeMitigatingFactors(baseBundle(), NOW);
    expect(factors.length).toBeGreaterThan(0);
    for (const f of factors) {
      expect(KNOWN_FACTOR_IDS.has(f.id)).toBe(true);
      expect(`${f.label} ${f.detail}`.toLowerCase()).not.toMatch(/fraude/);
    }
    const ids = factors.map((f) => f.id);
    expect(ids).toContain("AUCUNE_ENTITE_SIGNALEE");
    expect(ids).toContain("PAS_DE_PROCEDURE");
    expect(ids).toContain("ANCIENNETE_ETABLIE"); // créée en 2010, « now » 2026
    expect(ids).toContain("PREUVE_SOLIDE"); // 100 % confirmé
  });

  it("retire les atténuants quand la donnée les contredit", () => {
    const b = baseBundle();
    b.entities.push({
      id: "s1",
      type: "sanction",
      label: "Entité gelée",
      evidenceLevel: "confirmed",
    });
    b.events.push({
      id: "ev1",
      entityId: "co1",
      kind: "procedure_collective",
      title: "Procédure",
      evidenceLevel: "confirmed",
    });
    const ids = computeMitigatingFactors(b, NOW).map((f) => f.id);
    expect(ids).not.toContain("AUCUNE_ENTITE_SIGNALEE");
    expect(ids).not.toContain("PAS_DE_PROCEDURE");
  });

  it("détecte la concordance UBO déclaré / recalculé", () => {
    const b = baseBundle();
    b.entities.push({
      id: "p1",
      type: "person",
      label: "Jean Test",
      evidenceLevel: "confirmed",
    });
    b.edges.push({
      id: "e1",
      type: "DETIENT",
      source: "p1",
      target: "co1",
      weight: "100 %",
      evidenceLevel: "confirmed",
    });
    b.declaredUbo = [{ label: "Jean Test" }];
    const ids = computeMitigatingFactors(b, NOW).map((f) => f.id);
    expect(ids).toContain("UBO_CONCORDANT");
  });
});

// ── Familles de signaux (M8 / V6) ─────────────────────────────────────────

describe("familyForRule — taxonomie non accusatoire", () => {
  it("rattache les règles connues à leur famille", () => {
    expect(familyForRule("PROXIMITE_SANCTION")).toBe("sanctions");
    expect(familyForRule("CYCLE_DETENTION")).toBe("capital");
    expect(familyForRule("DIRIGEANT_MULTI_SOCIETES")).toBe("gouvernance");
  });

  it("retombe sur « structure » pour une règle inconnue", () => {
    expect(familyForRule("REGLE_INEXISTANTE")).toBe("structure");
  });
});
