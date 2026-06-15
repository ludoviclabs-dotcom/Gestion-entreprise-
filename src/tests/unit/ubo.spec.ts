import { describe, it, expect } from "vitest";
import type { CaseBundle } from "@/lib/graph/graph-types";
import { parsePct, computeUbo } from "@/lib/graph/ubo";
import { holdingUboBundle } from "@/lib/fixtures/cases/holding-ubo";
import { buildGraph } from "@/lib/graph/build-graph";
import { ECART_UBO_DECLARE } from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";

const pct = (u: { effectivePct: number }) => Math.round(u.effectivePct * 1000) / 10;

function bundleOf(
  entities: CaseBundle["entities"],
  edges: CaseBundle["edges"],
  rootSiren = "000000000",
): CaseBundle {
  return {
    case: { id: "t", title: "t", rootSiren },
    entities,
    edges,
    events: [],
    riskSignals: [],
  };
}

describe("parsePct", () => {
  it("parse les formats courants en fraction 0..1", () => {
    expect(parsePct("60 %")).toBeCloseTo(0.6);
    expect(parsePct("60%")).toBeCloseTo(0.6);
    expect(parsePct("60")).toBeCloseTo(0.6);
    expect(parsePct("12,5 %")).toBeCloseTo(0.125);
  });
  it("renvoie null sur l'inexploitable", () => {
    expect(parsePct(undefined)).toBeNull();
    expect(parsePct("")).toBeNull();
    expect(parsePct("majoritaire")).toBeNull();
    expect(parsePct("150 %")).toBeNull();
  });
});

describe("computeUbo — chaîne simple", () => {
  it("multiplie le long d'un seul chemin", () => {
    const b = bundleOf(
      [
        { id: "s", type: "company", label: "S", evidenceLevel: "confirmed" },
        { id: "h", type: "company", label: "H", evidenceLevel: "confirmed" },
        { id: "p", type: "person", label: "P", evidenceLevel: "declared" },
      ],
      [
        { id: "e1", type: "DETIENT", source: "h", target: "s", weight: "60 %", evidenceLevel: "declared" },
        { id: "e2", type: "DETIENT", source: "p", target: "h", weight: "100 %", evidenceLevel: "declared" },
      ],
      "s",
    );
    const ubo = computeUbo(b, "s");
    expect(ubo).toHaveLength(1);
    expect(pct(ubo[0])).toBe(60);
    expect(ubo[0].hasControl).toBe(true); // 100 % puis 60 % ≥ 50 % chaque étage
    expect(ubo[0].isBeneficialOwner).toBe(true);
  });
});

describe("computeUbo — fixture holding-ubo (3 mécanismes)", () => {
  const ubo = computeUbo(holdingUboBundle);
  const by = Object.fromEntries(ubo.map((u) => [u.label, u]));

  it("UBO simple par détention (Hélène MOREAU ≈ 29,4 %)", () => {
    expect(pct(by["Hélène MOREAU"])).toBeCloseTo(29.4, 0);
    expect(by["Hélène MOREAU"].isBeneficialOwner).toBe(true);
    expect(by["Hélène MOREAU"].hasControl).toBe(false);
  });

  it("UBO par chemins parallèles (Karim BENALI ≈ 32,3 %, 2 chemins, aucun ≥ 25 % seul)", () => {
    expect(pct(by["Karim BENALI"])).toBeCloseTo(32.3, 0);
    expect(by["Karim BENALI"].pathsCount).toBe(2);
    expect(by["Karim BENALI"].isBeneficialOwner).toBe(true);
    expect(by["Karim BENALI"].hasControl).toBe(false);
  });

  it("UBO par contrôle majoritaire malgré < 25 % (Sofia HADDAD ≈ 13,3 %)", () => {
    expect(pct(by["Sofia HADDAD"])).toBeCloseTo(13.3, 0);
    expect(by["Sofia HADDAD"].hasControl).toBe(true);
    expect(by["Sofia HADDAD"].isBeneficialOwner).toBe(true);
  });

  it("co-détenteur sous le seuil n'est pas UBO (Olivier PETIT ≈ 25,0 %, juste sous)", () => {
    expect(by["Olivier PETIT"].isBeneficialOwner).toBe(false);
  });
});

describe("computeUbo — cycle-safe", () => {
  it("ne boucle pas sur un cycle de détention", () => {
    const b = bundleOf(
      [
        { id: "a", type: "company", label: "A", evidenceLevel: "confirmed" },
        { id: "b", type: "company", label: "B", evidenceLevel: "confirmed" },
        { id: "p", type: "person", label: "P", evidenceLevel: "declared" },
      ],
      [
        { id: "e1", type: "DETIENT", source: "b", target: "a", weight: "60 %", evidenceLevel: "declared" },
        { id: "e2", type: "DETIENT", source: "a", target: "b", weight: "60 %", evidenceLevel: "declared" },
        { id: "e3", type: "DETIENT", source: "p", target: "b", weight: "40 %", evidenceLevel: "declared" },
      ],
      "a",
    );
    expect(() => computeUbo(b, "a")).not.toThrow();
  });
});

describe("ECART_UBO_DECLARE", () => {
  const ctx = {
    bundle: holdingUboBundle,
    graph: buildGraph(holdingUboBundle),
    thresholds: DEFAULT_THRESHOLDS,
  };

  it("émet un signal de divergence (registre incomplet/inexact)", () => {
    const signals = ECART_UBO_DECLARE.evaluate(ctx);
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("high");
    expect(signals[0].explanation).toMatch(/divergence/i);
    expect(signals[0].explanation).not.toMatch(/fraude/i);
  });

  it("ne nomme personne dans le signal (garde-fou CJUE)", () => {
    const [sig] = ECART_UBO_DECLARE.evaluate(ctx);
    expect(sig.explanation).not.toMatch(/MOREAU|BENALI|HADDAD|LEROY/);
  });

  it("ne se déclenche pas sans liste déclarée", () => {
    const noDeclared = { ...ctx, bundle: { ...holdingUboBundle, declaredUbo: [] } };
    expect(ECART_UBO_DECLARE.evaluate(noDeclared)).toHaveLength(0);
  });
});

describe("computeUbo — cas pièges (ÉTAPE 1)", () => {
  const co = (id: string) =>
    ({ id, type: "company", label: id.toUpperCase(), evidenceLevel: "confirmed" }) as const;
  const pe = (id: string) =>
    ({ id, type: "person", label: id.toUpperCase(), evidenceLevel: "declared" }) as const;
  const det = (source: string, target: string, weight: string) =>
    ({
      id: `e:${source}:${target}`,
      type: "DETIENT",
      source,
      target,
      weight,
      evidenceLevel: "declared",
    }) as const;

  it("dilution multi-niveaux sous le seuil : 60 % × 40 % = 24 % → non UBO", () => {
    const b = bundleOf(
      [co("s"), co("h"), pe("p")],
      [det("p", "h", "60 %"), det("h", "s", "40 %")],
      "s",
    );
    const u = computeUbo(b, "s")[0];
    expect(pct(u)).toBe(24);
    expect(u.isBeneficialOwner).toBe(false);
    expect(u.hasControl).toBe(false); // 40 % à l'étage final < 50 %
  });

  it("seuil EXACTEMENT 25 % → UBO ; juste en dessous → non UBO", () => {
    const at25 = bundleOf(
      [co("s"), co("h"), pe("p")],
      [det("p", "h", "100 %"), det("h", "s", "25 %")],
      "s",
    );
    const u25 = computeUbo(at25, "s")[0];
    expect(pct(u25)).toBe(25);
    expect(u25.isBeneficialOwner).toBe(true); // seuil inclusif (≥ 25 %)
    expect(u25.hasControl).toBe(false);

    const at24 = bundleOf(
      [co("s"), co("h"), pe("p")],
      [det("p", "h", "100 %"), det("h", "s", "24 %")],
      "s",
    );
    expect(computeUbo(at24, "s")[0].isBeneficialOwner).toBe(false);
  });

  it("chemins parallèles : 15 % + 15 % = 30 % (aucun chemin ≥ 25 % seul)", () => {
    const b = bundleOf(
      [co("s"), co("h1"), co("h2"), pe("p")],
      [
        det("h1", "s", "50 %"),
        det("h2", "s", "50 %"),
        det("p", "h1", "30 %"),
        det("p", "h2", "30 %"),
      ],
      "s",
    );
    const u = computeUbo(b, "s")[0];
    expect(pct(u)).toBe(30);
    expect(u.pathsCount).toBe(2);
    expect(u.isBeneficialOwner).toBe(true);
  });

  it("chaîne profonde (4 niveaux) : 0,8⁴ ≈ 41 % effectif", () => {
    const b = bundleOf(
      [co("s"), co("h1"), co("h2"), co("h3"), pe("p")],
      [
        det("h1", "s", "80 %"),
        det("h2", "h1", "80 %"),
        det("h3", "h2", "80 %"),
        det("p", "h3", "80 %"),
      ],
      "s",
    );
    const u = computeUbo(b, "s")[0];
    expect(pct(u)).toBeCloseTo(41, 0);
    expect(u.hasControl).toBe(true); // 80 % ≥ 50 % à chaque étage
    expect(u.isBeneficialOwner).toBe(true);
  });

  it("boucle de détention : le détenteur réel n'est compté qu'une fois (24 %)", () => {
    const b = bundleOf(
      [co("a"), co("b"), pe("p")],
      [det("b", "a", "60 %"), det("a", "b", "60 %"), det("p", "b", "40 %")],
      "a",
    );
    const person = computeUbo(b, "a").find((x) => x.personId === "p");
    expect(person).toBeDefined();
    expect(pct(person!)).toBe(24); // 60 % (b→a) × 40 % (p→b) ; le cycle a→b est ignoré
    expect(person!.pathsCount).toBe(1);
  });
});
