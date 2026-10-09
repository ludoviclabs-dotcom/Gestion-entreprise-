import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

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

// Sirene : état pilotable par test. Par défaut, une réponse « réelle » (non
// fixture) construite à partir de l'échantillon, pour isoler la garde des autres
// connecteurs. `isFixture: true` simule l'absence de clé INSEE en mode live.
const sireneState = vi.hoisted(() => ({ isFixture: false, httpStatus: 200 }));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() {
      return {
        raw: uniteLegaleFixture,
        endpoint: sireneState.isFixture ? "fixture:sirene-unite-legale" : "https://sirene.test/siren/552032534",
        httpStatus: sireneState.isFixture ? 0 : sireneState.httpStatus,
        isFixture: sireneState.isFixture,
      };
    },
    async getEtablissementSiege() {
      return {
        raw: etablissementFixture,
        endpoint: sireneState.isFixture ? "fixture:sirene-etablissement" : "https://sirene.test/siret/55203253400646",
        httpStatus: sireneState.isFixture ? 0 : sireneState.httpStatus,
        isFixture: sireneState.isFixture,
      };
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";
import { SourceError } from "@/lib/ingestion/errors";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";

describe("assembleCase — garde-fou fixtures en mode live", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    sireneState.isFixture = false;
    sireneState.httpStatus = 200;
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

  it("en mode live : INPI, gels et OpenSanctions en fixture n'injectent ni dirigeants, ni sanction, ni UBO", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const { bundle, sources } = await assembleCase("552032534");
    // Dirigeants INPI (fixture DANONE) absents d'un dossier réel.
    expect(bundle.entities.some((e) => e.type === "person")).toBe(false);
    expect(bundle.edges.some((e) => e.type === "DIRIGE")).toBe(false);
    // Aucune correspondance de sanction issue d'un échantillon.
    expect(bundle.entities.some((e) => e.type === "sanction")).toBe(false);
    expect(bundle.edges.some((e) => e.type === "EST_VISE_PAR")).toBe(false);
    // Aucun bénéficiaire effectif déclaré d'échantillon.
    expect(bundle.declaredUbo).toBeUndefined();
    // La trace reste honnête : les appels en fixture sont enregistrés comme tels.
    expect(sources.some((s) => s.source === "inpi" && s.isFixture)).toBe(true);
  });

  it("en mode live sans clé Sirene : refuse de fabriquer un dossier à partir de la fixture", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    sireneState.isFixture = true;
    const failure = await assembleCase("552032534").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SourceError);
    expect((failure as SourceError).source).toBe("sirene");
    expect((failure as SourceError).message).toContain("INSEE_SIRENE_API_KEY");
  });

  it("en mode démo sans clé Sirene : la fixture reste utilisable (zéro-clé)", async () => {
    sireneState.isFixture = true;
    const { bundle } = await assembleCase("552032534");
    expect(bundle.case.title).toBe("DANONE");
  });

  it("en mode live : SIREN inconnu (404) → erreur explicite, pas de dossier", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    sireneState.httpStatus = 404;
    const failure = await assembleCase("552032534").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SourceError);
    expect((failure as SourceError).message).toContain("introuvable");
  });

  it("en mode live : clé refusée (401) → erreur explicite avec le statut HTTP", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    sireneState.httpStatus = 401;
    const failure = await assembleCase("552032534").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SourceError);
    expect((failure as SourceError).message).toContain("HTTP 401");
  });
});
