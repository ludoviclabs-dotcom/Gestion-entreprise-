import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/connectors/http", () => ({
  fetchJson: mocks.fetchJson,
  RateLimiter: class {
    async wait() {}
  },
}));
vi.mock("@/lib/env", () => ({
  env: { PAPPERS_BASE_URL: "https://pappers.test/v2", PAPPERS_API_KEY: "TOKEN-SECRET" },
  isDemoMode: () => false,
  isPappersEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { pappers } from "@/lib/connectors/pappers";

describe("pappers.bySiren (live)", () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
  });

  it("succès : renvoie la réponse, sans jamais enregistrer le token dans l'endpoint", async () => {
    mocks.fetchJson.mockResolvedValue({
      data: { siren: "123456789", representants: [{ nom: "X" }] },
      status: 200,
    });
    const res = await pappers.bySiren("123456789");
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect(res.endpoint).not.toContain("TOKEN-SECRET");
    expect(res.endpoint).not.toContain("api_token");
    // …mais le token est bien envoyé à l'API.
    expect(String(mocks.fetchJson.mock.calls[0][0])).toContain("api_token=TOKEN-SECRET");
  });

  it("clé refusée (401) : résultat vide + statut conservé, le corps d'erreur n'est jamais une donnée", async () => {
    mocks.fetchJson.mockResolvedValue({
      data: { error: "Token invalide", siren: "999999999", representants: [{ nom: "PIEGE" }] },
      status: 401,
    });
    const res = await pappers.bySiren("123456789");
    const raw = res.raw as Record<string, unknown>;
    expect(res.httpStatus).toBe(401);
    expect(res.isFixture).toBe(false);
    expect(res.endpoint).toContain("erreur 401");
    expect(JSON.stringify(raw)).not.toContain("PIEGE");
    expect(raw.representants).toEqual([]);
    expect(mocks.captureMessage).toHaveBeenCalled();
  });

  it("panne réseau : ne lève jamais", async () => {
    mocks.fetchJson.mockRejectedValue(new Error("ECONNRESET"));
    const res = await pappers.bySiren("123456789");
    expect(res.httpStatus).toBe(0);
    expect(res.endpoint).toContain("(exception)");
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
