import { describe, it, expect } from "vitest";
import type { CaseBundle, CaseEdge, CaseEntity } from "@/lib/graph/graph-types";
import {
  analyzeUbo,
  meetsThreshold,
  uboPolicyFor,
  UBO_POLICIES,
  type UboAnalysis,
} from "@/lib/graph/ubo";

/**
 * Critères de la section 12.3 du cadrage : cas exacts à 25 %, au-dessus de
 * 25 %, à 50 % et droits particuliers ; règle française actuelle et règle
 * européenne future distinguées ; cycles, pourcentages absents et droits
 * inconnus produisent des limites visibles.
 */

const FR_DATE = "2026-10-09";
const AMLR_DATE = "2027-07-10";

const co = (id: string): CaseEntity => ({ id, type: "company", label: id.toUpperCase(), evidenceLevel: "confirmed" });
const pe = (id: string): CaseEntity => ({ id, type: "person", label: id.toUpperCase(), evidenceLevel: "declared" });
const own = (id: string, source: string, target: string, weight: string | undefined, extra: Partial<CaseEdge> = {}): CaseEdge => ({
  id,
  type: "DETIENT",
  source,
  target,
  weight,
  evidenceLevel: "declared",
  ...extra,
});

function bundle(entities: CaseEntity[], edges: CaseEdge[]): CaseBundle {
  return { case: { id: "t", title: "t", rootSiren: "" }, entities, edges, events: [], riskSignals: [] };
}

const owner = (a: UboAnalysis, id: string) => a.owners.find((o) => o.personId === id)!;
const kinds = (a: UboAnalysis) => a.limits.map((l) => l.kind);

describe("référentiels datés", () => {
  it("applique le CMF aujourd'hui et l'AMLR à partir du 10 juillet 2027", () => {
    expect(uboPolicyFor(FR_DATE).id).toBe("FR_CMF_R561_1");
    expect(uboPolicyFor("2027-07-09").id).toBe("FR_CMF_R561_1");
    expect(uboPolicyFor(AMLR_DATE).id).toBe("EU_AMLR_2024_1624");
  });

  it("distingue « plus de 25 % » et « 25 % ou plus »", () => {
    expect(meetsThreshold(0.25, UBO_POLICIES.FR_CMF_R561_1)).toBe(false);
    expect(meetsThreshold(0.2501, UBO_POLICIES.FR_CMF_R561_1)).toBe(true);
    expect(meetsThreshold(0.25, UBO_POLICIES.EU_AMLR_2024_1624)).toBe(true);
    expect(meetsThreshold(0.2499, UBO_POLICIES.EU_AMLR_2024_1624)).toBe(false);
  });
});

describe("seuils exacts", () => {
  // S détenue à 25 % par A, 26 % par B, 49 % par C (autres personnes).
  const b = bundle(
    [co("s"), pe("a"), pe("b"), pe("c")],
    [own("e1", "a", "s", "25 %"), own("e2", "b", "s", "26 %"), own("e3", "c", "s", "49 %")],
  );

  it("exactement 25 % : sous le seuil en droit français actuel", () => {
    const a = analyzeUbo(b, { rootId: "s", asOf: FR_DATE });
    expect(owner(a, "a").qualification).toBe("sous_le_seuil");
    expect(owner(a, "b").qualification).toBe("beneficiaire");
  });

  it("exactement 25 % : bénéficiaire effectif sous l'AMLR", () => {
    const a = analyzeUbo(b, { rootId: "s", asOf: AMLR_DATE });
    expect(owner(a, "a").qualification).toBe("beneficiaire");
  });

  it("le produit d'une chaîne 50 % × 50 % vaut exactement 25 %", () => {
    const chain = bundle(
      [co("s"), co("h"), pe("p")],
      [own("e1", "h", "s", "50 %"), own("e2", "p", "h", "50 %")],
    );
    const fr = owner(analyzeUbo(chain, { rootId: "s", asOf: FR_DATE }), "p");
    expect(fr.effectivePct).toBe(0.25);
    // Le seuil français n'est pas atteint ; seule la présomption de contrôle reste à examiner.
    expect(fr.qualification).toBe("a_examiner");
    expect(fr.reasons.join(" ")).not.toMatch(/du capital/);
    expect(owner(analyzeUbo(chain, { rootId: "s", asOf: AMLR_DATE }), "p").qualification).toBe("beneficiaire");
  });
});

describe("contrôle", () => {
  it("50 % des votes n'est pas une majorité", () => {
    const b = bundle(
      [co("s"), co("h"), pe("p"), pe("q")],
      [own("e1", "h", "s", "50 %"), own("e2", "q", "s", "50 %"), own("e3", "p", "h", "100 %")],
    );
    const a = analyzeUbo(b, { rootId: "s", asOf: FR_DATE });
    // 50/50 : personne n'a la majorité ; au mieux une présomption à examiner.
    expect(owner(a, "p").control).not.toBe("majorite");
    expect(owner(a, "p").hasControl).toBe(false);
    // 50 % du capital dépasse quand même le seuil de 25 %.
    expect(owner(a, "p").qualification).toBe("beneficiaire");
  });

  it("51 % à chaque étage : contrôle majoritaire même sous 25 % de capital", () => {
    const b = bundle(
      [co("s"), co("h1"), co("h2"), pe("p")],
      [own("e1", "h1", "s", "51 %"), own("e2", "h2", "h1", "51 %"), own("e3", "p", "h2", "51 %")],
    );
    const p = owner(analyzeUbo(b, { rootId: "s", asOf: FR_DATE }), "p");
    expect(p.effectivePct).toBeLessThan(0.25);
    expect(p.control).toBe("majorite");
    expect(p.qualification).toBe("beneficiaire");
  });

  it("capital et votes séparés : 10 % du capital mais 60 % des votes", () => {
    const b = bundle(
      [co("s"), pe("p"), pe("q")],
      [
        own("e1", "p", "s", "10 %", { votingWeight: "60 %" }),
        own("e2", "q", "s", "90 %", { votingWeight: "40 %" }),
      ],
    );
    const a = analyzeUbo(b, { rootId: "s", asOf: FR_DATE });
    expect(owner(a, "p").effectivePct).toBeCloseTo(0.1);
    expect(owner(a, "p").effectiveVotingPct).toBeCloseTo(0.6);
    expect(owner(a, "p").control).toBe("majorite");
    expect(owner(a, "p").qualification).toBe("beneficiaire");
    expect(kinds(a)).not.toContain("votes_supposes");
  });

  it("plus de 40 % des votes sans détenteur supérieur : présomption à examiner, pas une certitude", () => {
    // Personne P à 20 % via H (H détient 45 % de S) : sous le seuil de capital.
    const b = bundle(
      [co("s"), co("h"), pe("p"), pe("x"), pe("y"), pe("z")],
      [
        own("e1", "h", "s", "45 %"),
        own("e2", "x", "s", "20 %"),
        own("e3", "y", "s", "20 %"),
        own("e4", "z", "s", "15 %"),
        own("e5", "p", "h", "100 %"),
      ],
    );
    const a = analyzeUbo(b, { rootId: "s", asOf: FR_DATE });
    // 45 % de capital : bénéficiaire par le seuil, et la présomption ne change rien.
    expect(owner(a, "p").qualification).toBe("beneficiaire");
    expect(owner(a, "p").control).toBe("presomption");
  });

  it("présomption seule (capital sous le seuil) : à examiner", () => {
    const b = bundle(
      [co("s"), co("h"), pe("p"), pe("x"), pe("y")],
      [
        own("e1", "h", "s", "42 %"),
        own("e2", "x", "s", "30 %"),
        own("e3", "y", "s", "28 %"),
        own("e4", "p", "h", "55 %"),
      ],
    );
    const p = owner(analyzeUbo(b, { rootId: "s", asOf: FR_DATE }), "p");
    expect(p.effectivePct).toBeCloseTo(0.231, 3);
    expect(p.control).toBe("presomption");
    expect(p.qualification).toBe("a_examiner");
    expect(p.reasons.join(" ")).toMatch(/L\. 233-3/);
  });

  it("droits particuliers documentés : à examiner même sous le seuil", () => {
    const b = bundle(
      [co("s"), pe("p"), pe("q")],
      [
        own("e1", "p", "s", "10 %", { specialRights: "Droit de nommer la majorité du conseil (pacte)" }),
        own("e2", "q", "s", "90 %"),
      ],
    );
    const p = owner(analyzeUbo(b, { rootId: "s", asOf: FR_DATE }), "p");
    expect(p.qualification).toBe("a_examiner");
    expect(p.specialRights).toHaveLength(1);
  });
});

describe("limites visibles", () => {
  it("pourcentage absent : lien ignoré et signalé", () => {
    const b = bundle(
      [co("s"), pe("p"), pe("q")],
      [own("e1", "p", "s", "majoritaire"), own("e2", "q", "s", "30 %")],
    );
    const a = analyzeUbo(b, { rootId: "s", asOf: FR_DATE });
    expect(a.owners.map((o) => o.personId)).toEqual(["q"]);
    expect(kinds(a)).toContain("pourcentage_absent");
    expect(kinds(a)).toContain("capital_incomplet");
  });

  it("cycle : calcul interrompu et signalé", () => {
    const b = bundle(
      [co("a"), co("b"), pe("p")],
      [own("e1", "b", "a", "60 %"), own("e2", "a", "b", "60 %"), own("e3", "p", "b", "40 %")],
    );
    const a = analyzeUbo(b, { rootId: "a", asOf: FR_DATE });
    expect(kinds(a)).toContain("cycle");
  });

  it("total supérieur à 100 % : incohérence signalée", () => {
    const b = bundle([co("s"), pe("p"), pe("q")], [own("e1", "p", "s", "70 %"), own("e2", "q", "s", "60 %")]);
    expect(kinds(analyzeUbo(b, { rootId: "s", asOf: FR_DATE }))).toContain("total_incoherent");
  });

  it("le contrôle par d'autres moyens est toujours rappelé", () => {
    const b = bundle([co("s"), pe("p")], [own("e1", "p", "s", "100 %")]);
    expect(kinds(analyzeUbo(b, { rootId: "s", asOf: FR_DATE }))).toContain("autres_moyens");
  });

  it("lien inféré : qualification suspendue et limite affichée", () => {
    const b = bundle(
      [co("s"), pe("p"), pe("q")],
      [own("e1", "p", "s", "40 %", { evidenceLevel: "inferred" }), own("e2", "q", "s", "60 %")],
    );
    const a = analyzeUbo(b, { rootId: "s", asOf: FR_DATE });
    expect(owner(a, "p").qualification).toBe("a_examiner");
    expect(owner(a, "p").documentedPct).toBe(0);
    expect(kinds(a)).toContain("lien_hypothetique");
  });
});

describe("temporalité", () => {
  const b = bundle(
    [co("s"), pe("p"), pe("q")],
    [
      own("e1", "p", "s", "70 %", { validTo: "2025-12-31" }),
      own("e2", "q", "s", "70 %", { validFrom: "2026-01-01" }),
      own("e3", "p", "s", "30 %", { validFrom: "2026-01-01" }),
    ],
  );

  it("ne retient que les relations valides à la date choisie", () => {
    const before = analyzeUbo(b, { rootId: "s", asOf: "2025-06-30" });
    expect(owner(before, "p").effectivePct).toBeCloseTo(0.7);
    expect(before.owners.find((o) => o.personId === "q")).toBeUndefined();

    const after = analyzeUbo(b, { rootId: "s", asOf: "2026-06-30" });
    expect(owner(after, "p").effectivePct).toBeCloseTo(0.3);
    expect(owner(after, "q").effectivePct).toBeCloseTo(0.7);
    expect(kinds(after)).toContain("hors_periode");
  });
});
