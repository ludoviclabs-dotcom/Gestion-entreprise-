import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/connectors/http", () => ({
  fetchJson: vi.fn(),
  RateLimiter: class {
    async wait() {}
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    COMPANIES_HOUSE_BASE_URL: "https://ch.test",
    COMPANIES_HOUSE_API_KEY: "CH-SECRET",
  },
  isDemoMode: () => false,
  isCompaniesHouseEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { companiesHouse, normalizeCompanyNumber } from "@/lib/connectors/companies-house";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import { normalizeCompaniesHouse, displayName } from "@/lib/ingestion/normalize-companies-house";
import { companiesHouseParents } from "@/lib/ingestion/normalize-gleif";

// Données SYNTHÉTIQUES, à la forme réelle de l'API Companies House.
const companyJson = {
  company_number: "00445790",
  company_name: "EXEMPLE PLC",
  company_status: "active",
  type: "plc",
  date_of_creation: "1947-11-27",
  jurisdiction: "england-wales",
  sic_codes: ["47110"],
  registered_office_address: { address_line_1: "1 Rue Fictive", postal_code: "AB1 2CD" },
};
const officersJson = {
  total_results: 3,
  active_count: 2,
  resigned_count: 1,
  items_per_page: 100,
  items: [
    { name: "MURPHY, Ken", officer_role: "director", appointed_on: "2020-01-15", address: { postal_code: "X" } },
    { name: "EXEMPLE SECRETARIAL LIMITED", officer_role: "corporate-secretary", appointed_on: "2018-05-01" },
    { name: "ANCIEN, Paul", officer_role: "director", appointed_on: "2010-01-01", resigned_on: "2019-12-31" },
  ],
};
const pscJson = {
  total_results: 3,
  items: [
    {
      name: "HOLDING FICTIVE LIMITED",
      kind: "corporate-entity-person-with-significant-control",
      natures_of_control: ["ownership-of-shares-25-to-50-percent", "voting-rights-25-to-50-percent"],
      notified_on: "2016-04-06",
      identification: { registration_number: "07654321", legal_form: "ltd" },
    },
    {
      name: "DUPUIS, Marie",
      kind: "individual-person-with-significant-control",
      natures_of_control: ["right-to-appoint-and-remove-directors"],
      notified_on: "2017-01-01",
      date_of_birth: { month: 3, year: 1970 },
      nationality: "French",
    },
    {
      name: "ANCIEN ACTIONNAIRE, Jean",
      kind: "individual-person-with-significant-control",
      natures_of_control: ["ownership-of-shares-75-to-100-percent"],
      ceased_on: "2020-01-01",
    },
  ],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normalizeCompanyNumber", () => {
  it("complète à 8 chiffres et conserve les préfixes lettres", () => {
    expect(normalizeCompanyNumber("445790")).toBe("00445790");
    expect(normalizeCompanyNumber("00445790")).toBe("00445790");
    expect(normalizeCompanyNumber("sc123456")).toBe("SC123456");
    expect(normalizeCompanyNumber(" OC 301234 ")).toBe("OC301234");
  });
  it("refuse un format invalide", () => {
    for (const bad of ["", "ABCDEFGH", "12345678901", "../etc", null, undefined]) {
      expect(normalizeCompanyNumber(bad as string)).toBeNull();
    }
  });
});

describe("companiesHouse.byNumber (live)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const route = (map: Record<string, () => Response>) =>
    fetchMock.mockImplementation((url: string) => {
      const key = Object.keys(map).find((k) => String(url).includes(k));
      return Promise.resolve(key ? map[key]() : json(500, {}));
    });

  it("succès : dirigeants en fonction, PSC, sans secret ni donnée personnelle superflue", async () => {
    route({
      "/persons-with-significant-control": () => json(200, pscJson),
      "/officers": () => json(200, officersJson),
      "/company/00445790": () => json(200, companyJson),
    });
    const res = await companiesHouse.byNumber("445790");
    const raw = res.raw as {
      status: string;
      company: { number: string; name: string };
      officers: { name: string; corporate: boolean; resignedOn: string | null }[];
      officersActive: number;
      pscs: unknown[];
    };
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect(res.endpoint).toBe("https://ch.test/company/00445790");
    expect(raw.status).toBe("ok");
    expect(raw.company).toMatchObject({ number: "00445790", name: "EXEMPLE PLC" });
    // Démissionnaires exclus ; société détectée.
    expect(raw.officers.map((o) => o.name)).toEqual(["MURPHY, Ken", "EXEMPLE SECRETARIAL LIMITED"]);
    expect(raw.officers[1].corporate).toBe(true);
    expect(raw.officersActive).toBe(2);
    expect(raw.pscs).toHaveLength(3);
    // Minimisation : ni adresse, ni date de naissance, ni nationalité conservées.
    const dump = JSON.stringify(res.raw);
    for (const leaked of ["AB1 2CD", "Rue Fictive", "1970", "French"]) {
      expect(dump).not.toContain(leaked);
    }
    // Auth Basic : clé en login, mot de passe vide ; jamais dans l'endpoint.
    const headers = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe("Basic " + Buffer.from("CH-SECRET:").toString("base64"));
    expect(JSON.stringify(res)).not.toContain("CH-SECRET");
  });

  it("404 : absence (httpStatus 404), pas une panne", async () => {
    route({ "/company/": () => json(404, { errors: [{ error: "company-profile-not-found" }] }) });
    const res = await companiesHouse.byNumber("99999999");
    expect(res.httpStatus).toBe(404);
    expect((res.raw as { status: string }).status).toBe("not_found");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("401 : dégradé explicite, jamais « aucun dirigeant »", async () => {
    route({ "/company/": () => json(401, { error: "Invalid Authorization header" }) });
    const res = await companiesHouse.byNumber("00445790");
    expect(res.httpStatus).toBe(401);
    expect((res.raw as { status: string }).status).toBe("indisponible");
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(mocks.captureMessage).toHaveBeenCalled();
  });

  it("liste des dirigeants en erreur : tout le résultat est dégradé", async () => {
    route({
      "/persons-with-significant-control": () => json(200, pscJson),
      "/officers": () => json(500, {}),
      "/company/00445790": () => json(200, companyJson),
    });
    const res = await companiesHouse.byNumber("00445790");
    expect((res.raw as { status: string }).status).toBe("indisponible");
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });

  it("PSC en 404 : société sans déclaration, le reste est conservé", async () => {
    route({
      "/persons-with-significant-control": () => json(404, {}),
      "/officers": () => json(200, officersJson),
      "/company/00445790": () => json(200, companyJson),
    });
    const res = await companiesHouse.byNumber("00445790");
    const raw = res.raw as { status: string; pscs: unknown[] };
    expect(raw.status).toBe("ok");
    expect(raw.pscs).toEqual([]);
  });

  it("panne réseau : ne lève jamais", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const res = await companiesHouse.byNumber("00445790");
    expect(res.httpStatus).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("normalizeCompaniesHouse", () => {
  const ok = {
    status: "ok",
    company: {
      number: "00445790",
      name: "EXEMPLE PLC",
      status: "active",
      type: "plc",
      createdOn: "1947-11-27",
      jurisdiction: "england-wales",
      sicCodes: [],
    },
    officersTotal: 3,
    officersActive: 2,
    officers: [
      { name: "MURPHY, Ken", role: "director", corporate: false, appointedOn: "2020-01-15", resignedOn: null },
      { name: "EXEMPLE SECRETARIAL LIMITED", role: "corporate-secretary", corporate: true, appointedOn: "2018-05-01", resignedOn: null },
    ],
    pscTotal: 4,
    pscs: [
      { name: "HOLDING FICTIVE LIMITED", kind: "corporate-entity-person-with-significant-control", corporate: true, natures: ["ownership-of-shares-25-to-50-percent"], notifiedOn: "2016-04-06", ceasedOn: null, registrationNumber: "07654321" },
      { name: "DUPUIS, Marie", kind: "individual-person-with-significant-control", corporate: false, natures: ["right-to-appoint-and-remove-directors"], notifiedOn: "2017-01-01", ceasedOn: null, registrationNumber: null },
      { name: "ANCIEN, Jean", kind: "individual-person-with-significant-control", corporate: false, natures: [], notifiedOn: null, ceasedOn: "2020-01-01", registrationNumber: null },
      { name: "SECRET", kind: "super-secure-person-with-significant-control", corporate: false, natures: [], notifiedOn: null, ceasedOn: null, registrationNumber: null },
    ],
  };
  const COMPANY = "co:lei:2138002P5RNKC5W2JZ46";

  it("convertit « NOM, Prénom » et crée dirigeants + arêtes DIRIGE datées", () => {
    expect(displayName("MURPHY, Ken", false)).toBe("Ken MURPHY");
    expect(displayName("EXEMPLE LIMITED", true)).toBe("EXEMPLE LIMITED");
    const { entities, edges } = normalizeCompaniesHouse(ok, { companyId: COMPANY });
    const ken = entities.find((e) => e.id === "pe:ken-murphy");
    expect(ken).toMatchObject({ type: "person", label: "Ken MURPHY", evidenceLevel: "declared" });
    const sec = entities.find((e) => e.label === "EXEMPLE SECRETARIAL LIMITED");
    expect(sec?.type).toBe("company");
    const dirige = edges.filter((e) => e.type === "DIRIGE");
    expect(dirige).toHaveLength(2);
    expect(dirige.find((e) => e.source === "pe:ken-murphy")).toMatchObject({
      target: COMPANY,
      validFrom: "2020-01-15",
      label: "Administrateur (director)",
    });
  });

  it("PSC : tranche déclarée SANS pourcentage précis, personnes physiques masquées par défaut", () => {
    const { entities, edges } = normalizeCompaniesHouse(ok, { companyId: COMPANY });
    const detient = edges.filter((e) => e.type === "DETIENT");
    expect(detient).toHaveLength(1); // société PSC seulement
    expect(detient[0].source).toBe("co:gb:07654321");
    expect(detient[0].weight).toBeUndefined();
    expect(detient[0].label).toContain("parts : 25 à 50 %");
    expect(entities.some((e) => e.label.includes("DUPUIS") || e.label.includes("Marie"))).toBe(false);
  });

  it("PSC personnes physiques exposées seulement si le garde-fou UBO l'autorise", () => {
    const { entities, edges } = normalizeCompaniesHouse(ok, {
      companyId: COMPANY,
      exposeIndividualPsc: true,
    });
    expect(entities.some((e) => e.label === "Marie DUPUIS")).toBe(true);
    expect(edges.filter((e) => e.type === "DETIENT")).toHaveLength(2);
    // Contrôle cessé et identité masquée (super-secure) jamais importés.
    expect(entities.some((e) => /^SECRET$|ANCIEN|Jean/.test(e.label))).toBe(false);
  });

  it("enrichit la société mère (statut, n° Companies House) et ne lève jamais", () => {
    const { companyAttributes } = normalizeCompaniesHouse(ok, { companyId: COMPANY });
    expect(companyAttributes["N° Companies House"]).toBe("00445790");
    expect(companyAttributes["Statut (Companies House)"]).toBe("active");
    for (const bad of [null, undefined, {}, "x", { status: "not_found" }, { status: "indisponible" }]) {
      expect(normalizeCompaniesHouse(bad, { companyId: COMPANY })).toEqual({
        entities: [],
        edges: [],
        companyAttributes: {},
      });
    }
  });
});

describe("companiesHouseParents (GLEIF → Companies House)", () => {
  const parent = (lei: string, number: string | null, ra: string | null) => ({
    lei,
    legalName: "X",
    country: "GB",
    registeredAs: number,
    registrationAuthority: ra,
  });

  it("repère les mères immatriculées à Companies House (RA000585/586/587)", () => {
    const res = companiesHouseParents({
      subject: null,
      directParent: parent("LEI1", "00445790", "RA000585"),
      ultimateParent: parent("LEI2", "SC123456", "RA000587"),
    });
    expect(res).toEqual([
      { lei: "LEI1", number: "00445790" },
      { lei: "LEI2", number: "SC123456" },
    ]);
  });

  it("ignore les autres registres, les mères sans numéro, et dédoublonne", () => {
    expect(
      companiesHouseParents({
        directParent: parent("LEI1", "12345678", "RA000413"), // registre allemand
        ultimateParent: parent("LEI2", null, "RA000585"),
      }),
    ).toEqual([]);
    expect(
      companiesHouseParents({
        directParent: parent("LEI1", "00445790", "RA000585"),
        ultimateParent: parent("LEI1", "00445790", "RA000585"),
      }),
    ).toHaveLength(1);
    expect(companiesHouseParents(null)).toEqual([]);
  });
});
