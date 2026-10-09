import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/connectors/http", () => ({
  fetchJson: vi.fn(),
  // Le limiteur réel attendrait 5,5 s entre deux appels : inutile en test.
  RateLimiter: class {
    async wait() {}
  },
}));
vi.mock("@/lib/env", () => ({
  env: {
    GDELT_BASE_URL: "https://gdelt.test/api/v2",
    OPENSANCTIONS_BASE_URL: "https://os.test",
    OPENSANCTIONS_DATASET: "sanctions",
    OPENSANCTIONS_API_KEY: "KEY-SECRET",
  },
  isDemoMode: () => false,
  isGdeltEnabled: () => true,
  hasOpenSanctionsKey: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { gdelt } from "@/lib/connectors/gdelt";
import { openSanctions } from "@/lib/connectors/opensanctions";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";

const reply = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

describe("gdelt.byName (live)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("succès : renvoie les articles", async () => {
    fetchMock.mockResolvedValue(reply(200, JSON.stringify({ articles: [{ title: "x" }] })));
    const res = await gdelt.byName("ACME");
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect((res.raw as { articles: unknown[] }).articles).toHaveLength(1);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("429 puis succès : une 2ᵉ tentative suffit", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(429, "Please limit requests to one every 5 seconds"))
      .mockResolvedValueOnce(reply(200, JSON.stringify({ articles: [] })));
    const res = await gdelt.byName("ACME");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.httpStatus).toBe(200);
  });

  it("429 persistant : indisponibilité explicite (statut 429), jamais une exception", async () => {
    // Une réponse NEUVE par appel : un corps HTTP ne se lit qu'une fois.
    fetchMock.mockImplementation(() =>
      Promise.resolve(reply(429, "Please limit requests to one every 5 seconds")),
    );
    const res = await gdelt.byName("ACME");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.httpStatus).toBe(429);
    expect(res.isFixture).toBe(false);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect((res.raw as { articles: unknown[] }).articles).toEqual([]);
  });

  it("HTTP 200 mais corps non JSON : schéma non reconnu, pas un « aucun article »", async () => {
    fetchMock.mockResolvedValue(reply(200, "Your query was too short or too common."));
    const res = await gdelt.byName("AB");
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(res.endpoint).toContain("schéma non reconnu");
  });

  it("panne réseau : ne lève jamais", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const res = await gdelt.byName("ACME");
    expect(res.httpStatus).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("openSanctions.match (live)", () => {
  const fetchMock = vi.fn();
  const query = { company: { schema: "Company" as const, name: "ACME", identifier: "123456789" } };
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("clé refusée (401) : résultat vide à la forme attendue, statut conservé, pas de fuite", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid API key" }), { status: 401 }),
    );
    const res = await openSanctions.match(query);
    expect(res.httpStatus).toBe(401);
    expect(res.isFixture).toBe(false);
    expect(res.raw).toEqual({ responses: {} });
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(res.endpoint).not.toContain("KEY-SECRET");
    expect(mocks.captureMessage).toHaveBeenCalled();
  });

  it("panne réseau : ne lève jamais (sinon tout le dossier échouerait)", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const res = await openSanctions.match(query);
    expect(res.httpStatus).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("succès : renvoie la réponse telle quelle", async () => {
    const payload = { responses: { company: { results: [] } } };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    const res = await openSanctions.match(query);
    expect(res.httpStatus).toBe(200);
    expect(res.raw).toEqual(payload);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });
});
