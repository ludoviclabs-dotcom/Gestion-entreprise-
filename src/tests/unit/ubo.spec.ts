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
