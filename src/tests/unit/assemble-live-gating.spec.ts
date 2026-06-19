import { describe, it, expect, afterEach, vi } from "vitest";

// En mode live, BODACC (open data, sans clé/flag) appellerait l'API réelle.
// On le neutralise par une fixture pour garder ce test hors-ligne et déterministe.
vi.mock("@/lib/connectors/bodacc", () => ({
  bodacc: {
    async bySiren() {
      return {
        raw: { results: [] },
        endpoint: "fixture:bodacc-test",
        httpStatus: 0,
        isFixture: true,
      };
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";

describe("assembleCase — garde-fou fixtures en mode live", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  });

  it("en mode démo : la fixture EST la donnée (enrichissement GLEIF/VIES/BAN actif)", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE; // démo par défaut
    const { bundle } = await assembleCase("552032534");
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    expect(subject?.attributes?.["LEI"]).toBe("969500JBYTLER5DCB263");
    expect(subject?.attributes?.["TVA intracommunautaire"]).toBe("FR27552032534");
    expect(bundle.entities.some((e) => e.id.startsWith("ad:ban:"))).toBe(true);
  });

  it("en mode live + connecteurs désactivés : aucun enrichissement par fixture", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; // live, aucune clé → connecteurs en fixture
    const { bundle } = await assembleCase("552032534");
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    // GLEIF/VIES désactivés : pas de LEI/TVA d'échantillon greffés sur un dossier réel.
    expect(subject?.attributes?.["LEI"]).toBeUndefined();
    expect(subject?.attributes?.["TVA intracommunautaire"]).toBeUndefined();
    // BAN désactivé : pas de clé d'adresse canonique BAN (repli slug Sirene).
    expect(bundle.entities.some((e) => e.id.startsWith("ad:ban:"))).toBe(false);
    // Aucun facteur atténuant fondé sur la fixture TVA.
    const ids = computeMitigatingFactors(bundle).map((f) => f.id);
    expect(ids).not.toContain("TVA_INTRACOM_ACTIVE");
  });
});
