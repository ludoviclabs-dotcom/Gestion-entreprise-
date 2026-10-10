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
    ADEME_BASE_URL: "https://ademe.test",
    AGENCE_BIO_BASE_URL: "https://bio.test",
    DGAL_BASE_URL: "https://dgal.test",
    DGEFP_BASE_URL: "https://dgefp.test",
  },
  isDemoMode: () => false,
  isRgeEnabled: () => true,
  isAgenceBioEnabled: () => true,
  isAlimConfianceEnabled: () => true,
  isQualiopiEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { rge } from "@/lib/connectors/rge";
import { agenceBio } from "@/lib/connectors/agence-bio";
import { alimConfiance } from "@/lib/connectors/alim-confiance";
import { qualiopi } from "@/lib/connectors/qualiopi";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
const lastUrl = (fetchMock: ReturnType<typeof vi.fn>) =>
  decodeURIComponent(String(fetchMock.mock.calls.at(-1)?.[0]).replace(/\+/g, " "));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mocks.captureException.mockReset();
  mocks.captureMessage.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("rge.bySiren (ADEME data-fair)", () => {
  const line = (siret: string, over: Record<string, unknown> = {}) => ({
    siret,
    code_qualification: "C001D117",
    nom_qualification: "Offre globale de rénovation",
    meta_domaine: "Rénovation globale",
    organisme: "certibat",
    lien_date_debut: "2025-02-08",
    lien_date_fin: "2029-02-07",
    ...over,
  });

  it("interroge le préfixe SIRET = SIREN et lit total + lignes", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { total: 22, results: [line("55208131766522"), line("55208131765219")] }),
    );
    const res = await rge.bySiren("552081317");
    const url = lastUrl(fetchMock);
    expect(url).toContain("https://ademe.test/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines");
    expect(url).toContain("qs=siret:552081317*");
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
    const raw = res.raw as { total: number; lines: { siret: string; to: string; body: string }[] };
    expect(raw.total).toBe(22);
    expect(raw.lines).toHaveLength(2);
    expect(raw.lines[0]).toMatchObject({ siret: "55208131766522", to: "2029-02-07", body: "certibat" });
  });

  it("aucune ligne : absence avérée (200), pas une panne", async () => {
    fetchMock.mockResolvedValue(reply(200, { total: 0, results: [] }));
    const res = await rge.bySiren("123456782");
    expect((res.raw as { status: string; total: number }).status).toBe("ok");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("filtre ignoré par la source (SIRET d'une autre entreprise) : dégradé, jamais mélangé", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { total: 2, results: [line("55208131766522"), line("99999999900011")] }),
    );
    const res = await rge.bySiren("552081317");
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect((res.raw as { status: string }).status).toBe("indisponible");
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("SIREN invalide : aucune requête", async () => {
    const res = await rge.bySiren('552081317" or 1=1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect((res.raw as { total: number }).total).toBe(0);
  });

  it("5xx, non JSON, panne réseau : dégradé", async () => {
    fetchMock.mockResolvedValueOnce(reply(503, "maintenance"));
    const http = await rge.bySiren("552081317");
    expect(http.httpStatus).toBe(503);
    expect(isDegradedEndpoint(http.endpoint)).toBe(true);

    fetchMock.mockResolvedValueOnce(reply(200, "<html>"));
    expect(isDegradedEndpoint((await rge.bySiren("552081317")).endpoint)).toBe(true);

    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const net = await rge.bySiren("552081317");
    expect(net.httpStatus).toBe(0);
    expect(isDegradedEndpoint(net.endpoint)).toBe(true);
  });
});

describe("agenceBio.bySiren (Agence BIO)", () => {
  const operator = (siret: string) => ({
    siret,
    raisonSociale: "LIDL",
    gerant: "NOM PRENOM", // ne doit JAMAIS être repris
    telephone: "0102030405",
    adressesOperateurs: [{ lieu: "1 rue X" }],
    categories: [{ id: 6, nom: "Grandes surfaces généralistes" }],
    certificats: [
      {
        organisme: "Bureau Veritas Certification France",
        etatCertification: "ENGAGEE",
        dateEngagement: "2009-02-05",
        dateSuspension: null,
        dateArret: null,
      },
    ],
  });

  it("interroge par SIREN, minimise les données (aucun gérant, téléphone, adresse)", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { nbTotal: "862", items: [operator("34326262204422"), operator("34326262207391")] }),
    );
    const res = await agenceBio.bySiren("343262622");
    expect(lastUrl(fetchMock)).toContain("https://bio.test/api/gouv/operateurs/?siret=343262622&nb=50");
    const raw = res.raw as {
      total: number;
      operators: { siret: string; categories: string[]; certificates: { body: string; state: string; engagedOn: string }[] }[];
    };
    expect(raw.total).toBe(862); // « nbTotal » texte → nombre
    expect(raw.operators).toHaveLength(2);
    expect(raw.operators[0].certificates[0]).toMatchObject({
      body: "Bureau Veritas Certification France",
      state: "ENGAGEE",
      engagedOn: "2009-02-05",
    });
    const json = JSON.stringify(res.raw);
    expect(json).not.toMatch(/NOM PRENOM|0102030405|rue X/);
  });

  it("filtre ignoré (SIRET étranger au SIREN) : dégradé", async () => {
    fetchMock.mockResolvedValue(
      reply(200, { nbTotal: "137903", items: [operator("11111111100011")] }),
    );
    const res = await agenceBio.bySiren("343262622");
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });

  it("erreur 400 de la source : dégradé", async () => {
    fetchMock.mockResolvedValue(reply(400, {}));
    expect(isDegradedEndpoint((await agenceBio.bySiren("343262622")).endpoint)).toBe(true);
  });
});

describe("alimConfiance.bySiren (DGAL)", () => {
  it("agrège côté source par niveau (préfixe SIRET) et somme les contrôles", async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        total_count: 3,
        results: [
          { synthese_eval_sanit: "Très satisfaisant", n: 62, derniere: "2026-09-01T00:00:00+00:00" },
          { synthese_eval_sanit: "Satisfaisant", n: 92, derniere: "2026-10-07T00:00:00+00:00" },
          { synthese_eval_sanit: "A améliorer", n: 1, derniere: "2026-03-02T00:00:00+00:00" },
        ],
      }),
    );
    const res = await alimConfiance.bySiren("343262622");
    const url = lastUrl(fetchMock);
    expect(url).toContain("https://dgal.test/api/explore/v2.1/catalog/datasets/export_alimconfiance/records");
    expect(url).toContain('startswith(siret, "343262622")');
    expect(url).toContain("group_by=synthese_eval_sanit");
    const raw = res.raw as { total: number; levels: { level: string; count: number; latest: string }[] };
    expect(raw.total).toBe(155); // somme des niveaux, pas le nombre de groupes
    expect(raw.levels[1]).toEqual({ level: "Satisfaisant", count: 92, latest: "2026-10-07" });
  });

  it("aucun contrôle publié : absence avérée", async () => {
    fetchMock.mockResolvedValue(reply(200, { total_count: 0, results: [] }));
    const res = await alimConfiance.bySiren("123456782");
    expect((res.raw as { status: string; total: number }).total).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("erreur HTTP : dégradé", async () => {
    fetchMock.mockResolvedValue(reply(500, {}));
    expect(isDegradedEndpoint((await alimConfiance.bySiren("343262622")).endpoint)).toBe(true);
  });
});

describe("qualiopi.bySiren (DGEFP)", () => {
  it("rapproche par SIREN exact et traduit les booléens texte en catégories", async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        total_count: 1,
        results: [
          {
            numerodeclarationactivite: "11755589375",
            denomination: "EDF SA",
            siren: "552081317",
            siretetablissementdeclarant: "55208131766522",
            certifications_actionsdeformation: "true",
            certifications_bilansdecompetences: "false",
            certifications_vae: "false",
            certifications_actionsdeformationparapprentissage: "true",
          },
        ],
      }),
    );
    const res = await qualiopi.bySiren("552081317");
    const url = lastUrl(fetchMock);
    expect(url).toContain("https://dgefp.test/api/explore/v2.1/catalog/datasets/liste-publique-des-of-v2/records");
    expect(url).toContain('siren="552081317"');
    const raw = res.raw as { organisations: { nda: string; categories: string[] }[] };
    expect(raw.organisations[0].nda).toBe("11755589375");
    expect(raw.organisations[0].categories).toEqual([
      "actions de formation",
      "actions de formation par apprentissage",
    ]);
  });

  it("panne : dégradé, jamais « non certifié »", async () => {
    fetchMock.mockResolvedValue(reply(502, "bad gateway"));
    const res = await qualiopi.bySiren("552081317");
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect((res.raw as { status: string }).status).toBe("indisponible");
  });
});
