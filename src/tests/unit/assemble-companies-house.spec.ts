import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

// Active le connecteur AVANT le chargement de `@/lib/env` (parsé à l'import).
vi.hoisted(() => {
  process.env.COMPANIES_HOUSE_ENABLED = "true";
  process.env.COMPANIES_HOUSE_API_KEY = "test-key";
});

vi.mock("@/lib/connectors/bodacc", () => ({
  bodacc: {
    async bySiren() {
      return { raw: { results: [] }, endpoint: "https://bodacc.test", httpStatus: 200, isFixture: false };
    },
  },
}));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() {
      return { raw: uniteLegaleFixture, endpoint: "https://sirene.test/siren", httpStatus: 200, isFixture: false };
    },
    async getEtablissementSiege() {
      return { raw: etablissementFixture, endpoint: "https://sirene.test/siret", httpStatus: 200, isFixture: false };
    },
  },
}));

const state = vi.hoisted(() => ({
  parent: true,
  chStatus: 200,
  calls: [] as string[],
}));

vi.mock("@/lib/connectors/gleif", () => ({
  gleif: {
    async bySiren() {
      return {
        raw: {
          subject: { lei: "5493001KJTIIGC8Y1R12", legalName: "DANONE", country: "FR", registeredAs: "552032534" },
          directParent: state.parent
            ? {
                lei: "2138002P5RNKC5W2JZ46",
                legalName: "EXEMPLE PLC",
                country: "GB",
                registeredAs: "00445790",
                registrationAuthority: "RA000585",
              }
            : null,
          ultimateParent: null,
        },
        endpoint: "https://gleif.test",
        httpStatus: 200,
        isFixture: false,
      };
    },
  },
}));

vi.mock("@/lib/connectors/companies-house", () => ({
  companiesHouse: {
    async byNumber(number: string) {
      state.calls.push(number);
      if (state.chStatus !== 200) {
        return {
          raw: { status: "indisponible", company: null, officers: [], officersTotal: 0, officersActive: 0, pscs: [], pscTotal: 0 },
          endpoint: `https://ch.test/company/${number} (erreur ${state.chStatus})`,
          httpStatus: state.chStatus,
          isFixture: false,
        };
      }
      return {
        raw: {
          status: "ok",
          company: { number, name: "EXEMPLE PLC", status: "active", type: "plc", createdOn: "1947-11-27", jurisdiction: "england-wales", sicCodes: [] },
          officersTotal: 1,
          officersActive: 1,
          officers: [{ name: "MURPHY, Ken", role: "director", corporate: false, appointedOn: "2020-01-15", resignedOn: null }],
          pscTotal: 1,
          pscs: [
            { name: "HOLDING FICTIVE LIMITED", kind: "corporate-entity-person-with-significant-control", corporate: true, natures: ["ownership-of-shares-75-to-100-percent"], notifiedOn: "2016-04-06", ceasedOn: null, registrationNumber: "07654321" },
          ],
        },
        endpoint: `https://ch.test/company/${number}`,
        httpStatus: 200,
        isFixture: false,
      };
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";

describe("assembleCase — second saut Companies House (mère britannique via GLEIF)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    state.parent = true;
    state.chStatus = 200;
    state.calls.length = 0;
  });

  it("interroge Companies House pour la mère britannique et greffe dirigeants + contrôle", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const { bundle, sources } = await assembleCase("552032534");

    expect(state.calls).toEqual(["00445790"]);
    expect(sources.filter((s) => s.source === "companies_house")).toHaveLength(1);

    const parent = bundle.entities.find((e) => e.id === "co:lei:2138002P5RNKC5W2JZ46");
    expect(parent?.attributes?.["N° Companies House"]).toBe("00445790");

    const ken = bundle.entities.find((e) => e.label === "Ken MURPHY");
    expect(ken?.type).toBe("person");
    expect(
      bundle.edges.some(
        (e) => e.type === "DIRIGE" && e.source === ken?.id && e.target === parent?.id,
      ),
    ).toBe(true);
    expect(
      bundle.edges.some(
        (e) => e.type === "DETIENT" && e.source === "co:gb:07654321" && e.target === parent?.id,
      ),
    ).toBe(true);
  });

  it("aucune mère britannique : Companies House n'est pas appelé et ne laisse aucune trace", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.parent = false;
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toEqual([]);
    expect(sources.some((s) => s.source === "companies_house")).toBe(false);
  });

  it("panne Companies House : consultation tracée, rien n'est greffé, le dossier se crée", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.chStatus = 401;
    const { bundle, sources } = await assembleCase("552032534");
    const row = sources.find((s) => s.source === "companies_house");
    expect(row?.httpStatus).toBe(401);
    expect(bundle.entities.some((e) => e.label === "Ken MURPHY")).toBe(false);
  });

  it("mode démo : jamais d'appel Companies House", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toEqual([]);
    expect(sources.some((s) => s.source === "companies_house")).toBe(false);
  });
});
