import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.GLEIF_ENABLED = "true";
  process.env.BRREG_ENABLED = "true";
  process.env.ACRA_ENABLED = "true";
});

const state = vi.hoisted(() => ({
  parents: [] as { lei: string; legalName: string; registeredAs: string; registrationAuthority: string; country: string }[],
  calls: [] as { registry: string; number: string }[],
  result: null as null | ((registry: string, number: string) => unknown),
}));

const ok = <T,>(raw: T, endpoint: string, httpStatus = 200) => ({ raw, endpoint, httpStatus, isFixture: false });

vi.mock("@/lib/connectors/bodacc", () => ({ bodacc: { async bySiren() { return ok({ results: [] }, "https://bodacc.test"); } } }));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() { return ok(JSON.parse(JSON.stringify(uniteLegaleFixture)), "https://sirene.test/siren"); },
    async getEtablissementSiege() { return ok(etablissementFixture, "https://sirene.test/siret"); },
  },
}));
vi.mock("@/lib/connectors/gleif", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/gleif")>("@/lib/connectors/gleif");
  return {
    ...actual,
    gleif: {
      async bySiren() {
        const [direct, ultimate] = state.parents;
        return ok(
          {
            subject: { lei: "SUBJECTLEI0000000001", legalName: "SOCIETE SUJET", country: "FR", registeredAs: "552032534", registrationAuthority: "RA000189" },
            directParent: direct ?? null,
            ultimateParent: ultimate ?? null,
          },
          "https://gleif.test",
        );
      },
    },
  };
});
vi.mock("@/lib/connectors/foreign-registries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/foreign-registries")>("@/lib/connectors/foreign-registries");
  return {
    ...actual,
    foreignRegistries: {
      async lookup(registry: string, number: string) {
        state.calls.push({ registry, number });
        const raw = state.result ? state.result(registry, number) : { status: "not_found", registry, entity: null };
        const status = (raw as { status: string }).status;
        return ok(raw, `https://registre.test/${registry}/${number}`, status === "ok" ? 200 : status === "not_found" ? 404 : 503);
      },
    },
  };
});

import { assembleCase } from "@/lib/ingestion/assemble-case";

const equinor = {
  lei: "OW6OFBNCKXC4US5C7523", legalName: "EQUINOR ASA", country: "NO",
  registeredAs: "923 609 016", registrationAuthority: "RA000472",
};
const dbs = {
  lei: "5493007FKT78NKPM5V55", legalName: "DBS GROUP HOLDINGS LTD", country: "SG",
  registeredAs: "199901152M", registrationAuthority: "RA000523",
};
const entity = (over: Record<string, unknown> = {}) => ({
  number: "923609016", name: "EQUINOR ASA", form: "ASA — Allmennaksjeselskap", status: "en activité",
  registeredOn: "1995-03-12", bankrupt: false, inLiquidation: false, deletedOn: null,
  lastAccountsYear: 2025, industry: "Utvinning av råolje", employees: 21272, ...over,
});

describe("assembleCase — registres étrangers des sociétés mères (par identifiant)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.parents = [equinor];
    state.calls.length = 0;
    state.result = (registry, number) => ({ status: "ok", registry, entity: entity({ number }) });
  });
  afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; });

  it("interroge le registre norvégien avec le numéro GLEIF de la mère, trace une ligne de source", async () => {
    const { sources, bundle } = await assembleCase("552032534");
    expect(state.calls).toEqual([{ registry: "no", number: "923609016" }]);
    const rows = sources.filter((s) => s.source === "brreg");
    expect(rows).toHaveLength(1);
    expect(rows[0].endpoint).toContain("/no/923609016");
    // Attribut greffé sur le nœud société mère, sans nœud ni signal en plus.
    const parent = bundle.entities.find((e) => e.id === `co:lei:${equinor.lei}`);
    const text = parent?.attributes?.["Registre norvégien des entités (Brønnøysund)"] ?? "";
    expect(text).toContain("EQUINOR ASA");
    expect(text).toContain("exercice 2025");
    expect(bundle.riskSignals.filter((s) => s.subjectId === parent?.id)).toEqual([]);
  });

  it("deux mères de registres différents : une consultation chacune", async () => {
    state.parents = [equinor, dbs];
    const { sources } = await assembleCase("552032534");
    expect(state.calls.map((c) => c.registry).sort()).toEqual(["no", "sg"]);
    expect(sources.some((s) => s.source === "acra")).toBe(true);
  });

  it("mère immatriculée ailleurs (registre non couvert) ou sans mère : aucune consultation", async () => {
    state.parents = [{ ...equinor, registrationAuthority: "RA000585", registeredAs: "00445790" }];
    await assembleCase("552032534");
    expect(state.calls).toEqual([]);
    state.parents = [];
    await assembleCase("552032534");
    expect(state.calls).toEqual([]);
  });

  it("numéro inconnu (absence) : ligne de source tracée, aucun attribut inventé", async () => {
    state.result = (registry) => ({ status: "not_found", registry, entity: null });
    const { sources, bundle } = await assembleCase("552032534");
    expect(sources.find((s) => s.source === "brreg")?.httpStatus).toBe(404);
    const parent = bundle.entities.find((e) => e.id === `co:lei:${equinor.lei}`);
    expect(parent?.attributes?.["Registre norvégien des entités (Brønnøysund)"]).toBeUndefined();
  });

  it("démonstration : aucune consultation, aucune ligne de source", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toEqual([]);
    expect(sources.some((s) => s.source === "brreg" || s.source === "acra")).toBe(false);
  });
});
