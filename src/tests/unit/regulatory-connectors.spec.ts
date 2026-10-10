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
    GEORISQUES_BASE_URL: "https://geo.test",
    ANNUAIRE_BASE_URL: "https://annuaire.test",
  },
  isDemoMode: () => false,
  isGeorisquesEnabled: () => true,
  isAnnuaireAdministrationEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { georisques } from "@/lib/connectors/georisques";
import { annuaireAdministration } from "@/lib/connectors/annuaire-administration";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";

const reply = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const urls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map((c) => decodeURIComponent(String(c[0])));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mocks.captureException.mockReset();
  mocks.captureMessage.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const site = (siret: string, over: Record<string, unknown> = {}) => ({
  raisonSociale: "SITE",
  commune: "ROUEN",
  siret,
  regime: "Autorisation",
  statutSeveso: "Seveso seuil bas",
  ied: true,
  prioriteNationale: false,
  etatActivite: "En exploitation avec titre",
  inspections: [{ dateInspection: "2025-03-01" }, { dateInspection: "2026-07-21" }],
  rubriques: [{ numeroRubrique: "1436" }],
  documentsHorsInspection: [{ nomFichier: "AP" }],
  ...over,
});

describe("georisques.bySirets", () => {
  it("interroge CHAQUE SIRET exact et résume sans reprendre rapports ni rubriques", async () => {
    fetchMock.mockImplementation((u: string) => {
      const siret = new URL(u).searchParams.get("siret");
      return Promise.resolve(reply(200, { results: 1, data: [site(String(siret))] }));
    });
    const res = await georisques.bySirets(["30271596600537", "30271596600123"], { openTotal: 198 });
    expect(urls(fetchMock).sort()).toEqual([
      "https://geo.test/api/v1/installations_classees?siret=30271596600123&page=1&page_size=20",
      "https://geo.test/api/v1/installations_classees?siret=30271596600537&page=1&page_size=20",
    ]);
    const raw = res.raw as {
      queried: number;
      openTotal: number;
      sites: { siret: string; inspections: number; lastInspection: string; seveso: string; ied: boolean }[];
    };
    expect(raw.queried).toBe(2);
    expect(raw.openTotal).toBe(198);
    expect(raw.sites).toHaveLength(2);
    expect(raw.sites[0]).toMatchObject({ inspections: 2, lastInspection: "2026-07-21", seveso: "Seveso seuil bas", ied: true });
    // Minimisation : ni rubriques, ni documents, ni rapports d'inspection.
    expect(JSON.stringify(res.raw)).not.toMatch(/1436|AP|fichierInspection|documents/);
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("jamais de SIREN ni de préfixe : SIRET invalides écartés, aucune requête", async () => {
    const res = await georisques.bySirets(["552081317", "5520813*", "abc"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((res.raw as { sites: unknown[] }).sites).toEqual([]);
  });

  it("plafonne à 10 établissements", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, { results: 0, data: [] })));
    const sirets = Array.from({ length: 15 }, (_, i) => `55208131766${String(500 + i).padStart(3, "0")}`);
    await georisques.bySirets(sirets);
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("garde « filtre ignoré » : une ligne d'un autre SIRET n'est jamais reprise", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { results: 2, data: [site("11111111100011"), site("30271596600537")] }),
    );
    const res = await georisques.bySirets(["30271596600537"]);
    const sites = (res.raw as { sites: { siret: string }[] }).sites;
    expect(sites.map((s) => s.siret)).toEqual(["30271596600537"]);
  });

  it("un seul établissement en échec : toute la consultation est dégradée", async () => {
    fetchMock.mockImplementation((u: string) =>
      Promise.resolve(
        new URL(u).searchParams.get("siret") === "30271596600123"
          ? reply(500, "boom")
          : reply(200, { results: 0, data: [] }),
      ),
    );
    const res = await georisques.bySirets(["30271596600537", "30271596600123"]);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect((res.raw as { status: string }).status).toBe("indisponible");
  });

  it("aucune installation : absence avérée (200), pas une panne", async () => {
    fetchMock.mockResolvedValue(reply(200, { results: 0, data: [] }));
    const res = await georisques.bySirets(["55203253400703"]);
    expect((res.raw as { status: string; sites: unknown[] }).status).toBe("ok");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("panne réseau et corps non JSON : dégradé, sans exception", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const net = await georisques.bySirets(["55203253400703"]);
    expect(isDegradedEndpoint(net.endpoint)).toBe(true);
    fetchMock.mockResolvedValueOnce(reply(200, "<html>"));
    expect(isDegradedEndpoint((await georisques.bySirets(["55203253400703"])).endpoint)).toBe(true);
  });
});

describe("annuaireAdministration.bySiren", () => {
  it("rapproche par SIREN exact, ne sélectionne AUCUNE donnée personnelle", async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        total_count: 19,
        results: [
          {
            nom: "Mairie - Paris - 6e arrondissement",
            pivot: '[{"type_service_local": "mairie", "code_insee_commune": ["75106"]}]',
            url_service_public: "https://lannuaire.service-public.gouv.fr/x",
            affectation_personne: '[{"personne": {"nom": "DUPONT"}}]',
            telephone: "0102030405",
          },
        ],
      }),
    );
    const res = await annuaireAdministration.bySiren("217500016");
    const url = urls(fetchMock)[0];
    expect(url).toContain("https://annuaire.test/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records");
    expect(url).toContain('siren="217500016"');
    expect(url).toContain("select=nom,pivot,url_service_public");
    expect(url).not.toMatch(/affectation|telephone|courriel|personne/);
    const raw = res.raw as { total: number; services: { name: string; type: string; url: string }[] };
    expect(raw.total).toBe(19);
    expect(raw.services[0]).toMatchObject({ type: "mairie", name: "Mairie - Paris - 6e arrondissement" });
    expect(JSON.stringify(res.raw)).not.toMatch(/DUPONT|0102030405/);
  });

  it("SIREN invalide : aucune requête ; erreur HTTP : dégradé", async () => {
    await annuaireAdministration.bySiren('217500016" or 1=1');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(reply(503, "x"));
    expect(isDegradedEndpoint((await annuaireAdministration.bySiren("217500016")).endpoint)).toBe(true);
  });

  it("pivot illisible : type nul, jamais d'exception", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { total_count: 1, results: [{ nom: "X", pivot: "{pas du json", url_service_public: null }] }),
    );
    const res = await annuaireAdministration.bySiren("217500016");
    expect((res.raw as { services: { type: string | null }[] }).services[0].type).toBeNull();
  });
});
