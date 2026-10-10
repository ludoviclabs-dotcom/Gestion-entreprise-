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
  env: { RECHERCHE_ENTREPRISES_BASE_URL: "https://re.test" },
  isDemoMode: () => false,
  isRechercheEntreprisesEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { rechercheEntreprises, simplifyResult } from "@/lib/connectors/recherche-entreprises";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import {
  rechercheAttributes,
  rechercheDirigeants,
} from "@/lib/ingestion/normalize-recherche-entreprises";

// Forme RÉELLE de l'API (relevée en live), valeurs SYNTHÉTIQUES.
const apiResult = {
  siren: "123456789",
  nom_complet: "EXEMPLE SA (EX)",
  nom_raison_sociale: "EXEMPLE SA",
  etat_administratif: "A",
  nature_juridique: "5599",
  date_creation: "1955-01-01",
  date_mise_a_jour_rne: "2026-02-27T11:58:00",
  dirigeants: [
    {
      nom: "DUPONT",
      prenoms: "Alice",
      annee_de_naissance: "1970",
      date_de_naissance: "1970-03",
      qualite: "Présidente",
      nationalite: "Française",
      type_dirigeant: "personne physique",
    },
    {
      siren: "987654321",
      denomination: "HOLDING FICTIVE SAS",
      qualite: "Administrateur",
      type_dirigeant: "personne morale",
    },
    {
      siren: "111222333",
      denomination: "CABINET AUDIT FICTIF",
      qualite: "Commissaire aux comptes titulaire",
      type_dirigeant: "personne morale",
    },
    { nom: "", prenoms: "", qualite: "Autre", type_dirigeant: "personne physique" },
  ],
  finances: {
    "2022": { ca: 1000, resultat_net: 100 },
    "2024": { ca: 2000000, resultat_net: 150000 },
    "2023": { ca: null, resultat_net: null },
  },
  complements: { est_bio: true, est_rge: false, est_qualiopi: true, est_alim_confiance: true, egapro_renseignee: true },
  tva: ["FR12123456789"],
};
const page = (results: unknown[]) => ({ results, total_results: results.length, page: 1, per_page: 5 });

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

describe("simplifyResult", () => {
  it("réduit la réponse à la forme minimale, sans donnée personnelle superflue", () => {
    const r = simplifyResult(apiResult);
    expect(r.status).toBe("ok");
    expect(r.company).toMatchObject({
      siren: "123456789",
      name: "EXEMPLE SA (EX)",
      legalCategory: "5599",
      rneUpdatedOn: "2026-02-27T11:58:00",
    });
    expect(r.finances).toEqual([{ annee: 2024, ca: 2000000, resultatNet: 150000 }, { annee: 2022, ca: 1000, resultatNet: 100 }]);
    // Seuls les indicateurs vrais ET retenus.
    expect(r.labels).toEqual(["Agriculture biologique", "Qualiopi", "Alim'confiance"]);
    // Minimisation : ni date de naissance, ni nationalité.
    const dump = JSON.stringify(r);
    for (const leaked of ["1970", "Française", "nationalite", "naissance"]) {
      expect(dump).not.toContain(leaked);
    }
  });
});

describe("rechercheEntreprises.bySiren (live)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("succès : retient le résultat dont le SIREN correspond EXACTEMENT", async () => {
    fetchMock.mockResolvedValue(
      reply(200, page([{ ...apiResult, siren: "999999999" }, apiResult])),
    );
    const res = await rechercheEntreprises.bySiren("123456789");
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
    expect((res.raw as { company: { siren: string } }).company.siren).toBe("123456789");
  });

  it("SIREN absent des résultats : absence avérée, pas une panne", async () => {
    fetchMock.mockResolvedValue(reply(200, page([])));
    const res = await rechercheEntreprises.bySiren("123456789");
    expect(res.httpStatus).toBe(200);
    expect((res.raw as { status: string }).status).toBe("not_found");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("429 puis succès : une seule nouvelle tentative", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(429, "Too many requests", { "retry-after": "0.01" }))
      .mockResolvedValueOnce(reply(200, page([apiResult])));
    const res = await rechercheEntreprises.bySiren("123456789");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.httpStatus).toBe(200);
  });

  it("429 persistant : indisponibilité explicite", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(reply(429, "Too many requests", { "retry-after": "0.01" })),
    );
    const res = await rechercheEntreprises.bySiren("123456789");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.httpStatus).toBe(429);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect((res.raw as { status: string }).status).toBe("indisponible");
  });

  it("5xx, corps non JSON, schéma inattendu : dégradé, jamais « aucun dirigeant »", async () => {
    fetchMock.mockResolvedValueOnce(reply(503, "maintenance"));
    const http = await rechercheEntreprises.bySiren("123456789");
    expect(isDegradedEndpoint(http.endpoint)).toBe(true);

    fetchMock.mockResolvedValueOnce(reply(200, "<html>erreur</html>"));
    const html = await rechercheEntreprises.bySiren("123456789");
    expect(html.endpoint).toContain("schéma non reconnu");

    fetchMock.mockResolvedValueOnce(reply(200, { inattendu: true }));
    const shape = await rechercheEntreprises.bySiren("123456789");
    expect(isDegradedEndpoint(shape.endpoint)).toBe(true);
    expect((shape.raw as { dirigeants: unknown[] }).dirigeants).toEqual([]);
  });

  it("panne réseau : ne lève jamais", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const res = await rechercheEntreprises.bySiren("123456789");
    expect(res.httpStatus).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("rechercheDirigeants / rechercheAttributes", () => {
  const ok = simplifyResult(apiResult);
  const COMPANY = "co:123456789";

  it("crée personnes physiques et morales dirigeantes (arêtes DIRIGE déclarées)", () => {
    const { entities, edges } = rechercheDirigeants(ok, COMPANY);
    expect(entities.map((e) => e.id).sort()).toEqual(["co:987654321", "pe:alice-dupont"].sort());
    const alice = entities.find((e) => e.id === "pe:alice-dupont");
    expect(alice).toMatchObject({ type: "person", label: "Alice DUPONT", evidenceLevel: "declared" });
    expect(edges.every((e) => e.type === "DIRIGE" && e.target === COMPANY)).toBe(true);
    expect(edges.find((e) => e.source === "pe:alice-dupont")?.label).toBe("Présidente");
  });

  it("n'érige PAS les commissaires aux comptes en dirigeants", () => {
    const { entities, edges } = rechercheDirigeants(ok, COMPANY);
    expect(entities.some((e) => /AUDIT/.test(e.label))).toBe(false);
    expect(edges.some((e) => e.source === "co:111222333")).toBe(false);
    expect(rechercheAttributes(ok)["Commissaires aux comptes"]).toBe("CABINET AUDIT FICTIF");
  });

  it("greffe comptes, indicateurs et fraîcheur du RNE", () => {
    const a = rechercheAttributes(ok);
    expect(a["CA (dernier exercice)"]).toContain("(2024)");
    expect(a["Résultat net"]).toContain("(2024)");
    expect(a["Source des comptes"]).toBe("Recherche d'entreprises (DINUM)");
    expect(a["Indicateurs publics"]).toBe("Agriculture biologique, Qualiopi, Alim'confiance");
    expect(a["Dirigeants — RNE mis à jour le"]).toBe("2026-02-27");
  });

  it("n'invente rien : absence ou panne → vide, sans lever", () => {
    for (const bad of [null, undefined, {}, "x", { status: "not_found" }, { status: "indisponible" }]) {
      expect(rechercheDirigeants(bad, COMPANY)).toEqual({ entities: [], edges: [] });
      expect(rechercheAttributes(bad)).toEqual({});
    }
  });
});
