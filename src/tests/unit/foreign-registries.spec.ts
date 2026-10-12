import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@/lib/connectors/http", () => ({
  fetchJson: vi.fn(),
  // Le limiteur réel espacerait les appels de plusieurs secondes : inutile en test.
  RateLimiter: class {
    async wait() {}
  },
}));
vi.mock("@/lib/env", () => ({
  isDemoMode: () => false,
  isBrregEnabled: () => true,
  isAcraEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException, captureMessage: vi.fn() }));

import {
  foreignRegistries,
  foreignRegistryParents,
  normalizeRegistryNumber,
  simplifyAcra,
  simplifyBrreg,
} from "@/lib/connectors/foreign-registries";
import { foreignRegistryAttributes } from "@/lib/ingestion/normalize-foreign-registry";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";

const brregEquinor = {
  organisasjonsnummer: "923609016",
  navn: "EQUINOR ASA",
  organisasjonsform: { kode: "ASA", beskrivelse: "Allmennaksjeselskap" },
  registreringsdatoEnhetsregisteret: "1995-03-12",
  konkurs: false,
  underAvvikling: false,
  underTvangsavviklingEllerTvangsopplosning: false,
  sisteInnsendteAarsregnskap: "2025",
  antallAnsatte: 21272,
  naeringskode1: { beskrivelse: "Utvinning av råolje", kode: "06.100" },
  // Données personnelles / de contact : jamais conservées.
  forretningsadresse: { adresse: ["Forusbeen 50"], poststed: "STAVANGER" },
  telefon: "+47 00000000",
  hjemmeside: "www.equinor.com",
};

const acraDbs = {
  uen: "199901152M",
  issuance_agency_desc: "ACRA",
  uen_status_desc: "Registered",
  entity_name: "DBS GROUP HOLDINGS LTD",
  entity_type_desc: "Local Company",
  uen_issue_date: "1999-03-09",
  reg_street_name: "MARINA BOULEVARD",
  reg_postal_code: "018982",
};

describe("normalizeRegistryNumber / foreignRegistryParents", () => {
  it("normalise les numéros publiés par GLEIF (espaces, tirets)", () => {
    expect(normalizeRegistryNumber("no", "923 609 016")).toBe("923609016");
    expect(normalizeRegistryNumber("no", "12345")).toBeNull();
    expect(normalizeRegistryNumber("sg", "199901152m")).toBe("199901152M");
    expect(normalizeRegistryNumber("sg", "??")).toBeNull();
  });

  it("repère les mères norvégiennes et singapouriennes par code RA, dédoublonnées", () => {
    const parents = foreignRegistryParents({
      directParent: { lei: "L1", registeredAs: "923 609 016", registrationAuthority: "RA000472" },
      ultimateParent: { lei: "L2", registeredAs: "199901152M", registrationAuthority: "RA000523" },
    });
    expect(parents).toEqual([
      { lei: "L1", registry: "no", number: "923609016" },
      { lei: "L2", registry: "sg", number: "199901152M" },
    ]);
    // Autre registre (Companies House), numéro absent ou invalide : ignorés.
    expect(
      foreignRegistryParents({
        directParent: { lei: "L3", registeredAs: "00445790", registrationAuthority: "RA000585" },
        ultimateParent: { lei: "L4", registeredAs: "12", registrationAuthority: "RA000472" },
      }),
    ).toEqual([]);
    expect(foreignRegistryParents(null)).toEqual([]);
  });
});

describe("simplifyBrreg / simplifyAcra — minimisation", () => {
  it("Norvège : identité, forme, statut, dates ; ni adresse, ni téléphone, ni site", () => {
    const e = simplifyBrreg(brregEquinor)!;
    expect(e).toMatchObject({
      number: "923609016", name: "EQUINOR ASA", form: "ASA — Allmennaksjeselskap", status: "en activité",
      registeredOn: "1995-03-12", bankrupt: false, lastAccountsYear: 2025, employees: 21272,
      industry: "Utvinning av råolje",
    });
    expect(JSON.stringify(e)).not.toMatch(/Forusbeen|telefon|\+47|equinor\.com/);
  });

  it("Norvège : faillite, liquidation, radiation reconnues", () => {
    expect(simplifyBrreg({ ...brregEquinor, konkurs: true })!.status).toBe("en faillite");
    expect(simplifyBrreg({ ...brregEquinor, underAvvikling: true })!.status).toBe("en liquidation");
    expect(simplifyBrreg({ ...brregEquinor, slettedato: "2024-05-01" })!).toMatchObject({ status: "radiée", deletedOn: "2024-05-01" });
  });

  it("Singapour : identité, type, statut, date d'immatriculation ; pas d'adresse", () => {
    const e = simplifyAcra(acraDbs)!;
    expect(e).toMatchObject({
      number: "199901152M", name: "DBS GROUP HOLDINGS LTD", form: "Local Company", status: "Registered",
      registeredOn: "1999-03-09", inLiquidation: false,
    });
    expect(JSON.stringify(e)).not.toMatch(/MARINA|018982/);
    expect(simplifyAcra({ ...acraDbs, uen_status_desc: "Struck Off" })!.inLiquidation).toBe(true);
  });

  it("réponses inexploitables : null, jamais d'exception", () => {
    expect(simplifyBrreg(null)).toBeNull();
    expect(simplifyBrreg({ navn: "X" })).toBeNull();
    expect(simplifyAcra({ uen: "1" })).toBeNull();
  });
});

describe("foreignRegistries.lookup (live)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.captureException.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const json = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

  it("Norvège : succès, endpoint sans secret, interrogé par numéro", async () => {
    fetchMock.mockImplementation(() => json(200, brregEquinor));
    const res = await foreignRegistries.lookup("no", "923 609 016");
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect(res.endpoint).toBe("https://data.brreg.no/enhetsregisteret/api/enheter/923609016");
    expect(res.raw).toMatchObject({ status: "ok", registry: "no", entity: { name: "EQUINOR ASA" } });
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("Norvège : numéro inconnu → 404 (absence, pas une panne)", async () => {
    fetchMock.mockImplementation(() => json(404, { feilmelding: "ikke funnet" }));
    const res = await foreignRegistries.lookup("no", "000000000");
    expect(res.httpStatus).toBe(404);
    expect(res.raw.status).toBe("not_found");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("Singapour : succès par UEN ; aucun enregistrement → absence", async () => {
    fetchMock.mockImplementationOnce(() => json(200, { success: true, result: { records: [acraDbs] } }));
    const ok = await foreignRegistries.lookup("sg", "199901152M");
    expect(ok.raw).toMatchObject({ status: "ok", registry: "sg", entity: { name: "DBS GROUP HOLDINGS LTD" } });
    expect(ok.endpoint).toContain("filters=");

    fetchMock.mockImplementationOnce(() => json(200, { success: true, result: { records: [] } }));
    const none = await foreignRegistries.lookup("sg", "199901152M");
    expect(none.httpStatus).toBe(404);
    expect(none.raw.status).toBe("not_found");
  });

  it("limitation de débit (429) ou erreur serveur : consultation dégradée, jamais « absent »", async () => {
    fetchMock.mockImplementation(() => json(429, { code: 24, name: "TOO_MANY_REQUESTS" }));
    const throttled = await foreignRegistries.lookup("sg", "199901152M");
    expect(throttled.httpStatus).toBe(429);
    expect(isDegradedEndpoint(throttled.endpoint)).toBe(true);
    expect(throttled.raw.status).toBe("indisponible");

    fetchMock.mockImplementation(() => json(503, {}));
    const down = await foreignRegistries.lookup("no", "923609016");
    expect(isDegradedEndpoint(down.endpoint)).toBe(true);
  });

  it("schéma non reconnu et panne réseau : dégradés, sans lever", async () => {
    fetchMock.mockImplementation(() => json(200, { surprise: true }));
    const odd = await foreignRegistries.lookup("no", "923609016");
    expect(odd.endpoint).toContain("(schéma non reconnu)");

    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const down = await foreignRegistries.lookup("no", "923609016");
    expect(down.httpStatus).toBe(0);
    expect(down.endpoint).toContain("(exception)");
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("numéro invalide : aucun appel réseau", async () => {
    const res = await foreignRegistries.lookup("no", "12");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.httpStatus).toBe(400);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });
});

describe("foreignRegistryAttributes", () => {
  it("décrit le registre, sans interprétation, et nomme l'identifiant", () => {
    const text = foreignRegistryAttributes({
      status: "ok",
      registry: "no",
      entity: simplifyBrreg({ ...brregEquinor, konkurs: true }),
    })["Registre norvégien des entités (Brønnøysund)"];
    expect(text).toContain("EQUINOR ASA");
    expect(text).toContain("faillite déclarée au registre");
    expect(text).toContain("derniers comptes annuels déposés : exercice 2025");
    expect(text).toContain("n° 923609016");
    expect(text).toContain("Interrogé par identifiant");
  });

  it("absence, panne ou entrée inconnue : aucun attribut", () => {
    expect(foreignRegistryAttributes({ status: "not_found", registry: "no", entity: null })).toEqual({});
    expect(foreignRegistryAttributes({ status: "indisponible", registry: "sg", entity: null })).toEqual({});
    expect(foreignRegistryAttributes(null)).toEqual({});
  });
});
