import { describe, it, expect } from "vitest";
import { frVatFromSiren } from "@/lib/connectors/vies";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";
import type { CaseBundle } from "@/lib/graph/graph-types";

describe("frVatFromSiren — clé TVA intracommunautaire FR", () => {
  it("dérive la clé (12 + 3·(SIREN mod 97)) mod 97 sur 2 chiffres", () => {
    // SIREN 552032534 : 552032534 mod 97 = 5 → clé (12+15) mod 97 = 27.
    expect(frVatFromSiren("552032534")).toEqual({
      countryCode: "FR",
      number: "27552032534",
      full: "FR27552032534",
    });
    // SIREN 404833048 : mod 97 = 56 → clé (12+168) mod 97 = 83.
    expect(frVatFromSiren("404833048")?.full).toBe("FR83404833048");
  });

  it("ignore les espaces du SIREN", () => {
    expect(frVatFromSiren("552 032 534")?.full).toBe("FR27552032534");
  });

  it("renvoie null si le SIREN n'a pas 9 chiffres", () => {
    expect(frVatFromSiren("12345")).toBeNull();
    expect(frVatFromSiren("abcdefghi")).toBeNull();
    expect(frVatFromSiren("")).toBeNull();
  });
});

function bundleWithTva(statut: string): CaseBundle {
  return {
    case: { id: "111222333", title: "ACME", rootSiren: "111222333" },
    entities: [
      {
        id: "co:111222333",
        type: "company",
        label: "ACME",
        evidenceLevel: "declared",
        attributes: {
          SIREN: "111222333",
          "TVA intracommunautaire": "FR00111222333",
          "Statut TVA (VIES)": statut,
        },
      },
    ],
    edges: [],
    events: [],
    riskSignals: [],
  };
}

describe("facteur atténuant TVA intracommunautaire (VIES)", () => {
  const NOW = new Date(Date.UTC(2026, 0, 1));

  it("émet TVA_INTRACOM_ACTIVE quand le statut VIES est actif", () => {
    const ids = computeMitigatingFactors(bundleWithTva("active"), NOW).map((f) => f.id);
    expect(ids).toContain("TVA_INTRACOM_ACTIVE");
  });

  it("n'émet rien quand la TVA est inactive (neutre, pas un signal)", () => {
    const ids = computeMitigatingFactors(bundleWithTva("inactive"), NOW).map((f) => f.id);
    expect(ids).not.toContain("TVA_INTRACOM_ACTIVE");
  });
});
