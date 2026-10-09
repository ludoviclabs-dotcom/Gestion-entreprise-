import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/connectors/http", () => ({
  fetchJson: mocks.fetchJson,
  RateLimiter: class {},
}));
vi.mock("@/lib/env", () => ({
  env: { TRESOR_GELS_BASE_URL: "https://gels.test/api/v1" },
  isDemoMode: () => false,
  isTresorGelsEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

const publication = {
  Publications: {
    DatePublication: "2026-10-01",
    PublicationDetail: [
      { Nature: "Personne morale", Nom: "ACME INTERNATIONAL HOLDING LTD" },
      { Nature: "Personne morale", Nom: "AUTRE ENTITE FICTIVE" },
    ],
  },
};

async function freshConnector() {
  vi.resetModules(); // vide le cache mémoire du connecteur
  return (await import("@/lib/connectors/tresor-gels")).tresorGels;
}

describe("tresorGels.match (live)", () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
  });

  it("renvoie les correspondances, jamais la publication complète", async () => {
    mocks.fetchJson.mockResolvedValue({ data: publication, status: 200 });
    const res = await (await freshConnector()).match({
      siren: "123456789",
      name: "Acme International Holding",
    });
    const raw = res.raw as Record<string, unknown>;
    expect(res.isFixture).toBe(false);
    expect(res.httpStatus).toBe(200);
    expect(raw.status).toBe("ok");
    expect(raw.entriesCount).toBe(2);
    expect(raw.publicationDate).toBe("2026-10-01");
    expect((raw.matches as unknown[]).length).toBe(1);
    // Le fichier complet (> 10 Mo en production) ne doit pas être persisté.
    expect(raw).not.toHaveProperty("publication");
    expect(JSON.stringify(raw)).not.toContain("AUTRE ENTITE FICTIVE");
  });

  it("envoie un User-Agent (obligatoire depuis janvier 2025)", async () => {
    mocks.fetchJson.mockResolvedValue({ data: publication, status: 200 });
    await (await freshConnector()).match({ name: "Acme" });
    const opts = mocks.fetchJson.mock.calls[0][1] as { headers: Record<string, string> };
    expect(opts.headers["User-Agent"]).toMatch(/KYB-Graph/);
  });

  it("met la publication en cache (un seul téléchargement pour deux dossiers)", async () => {
    mocks.fetchJson.mockResolvedValue({ data: publication, status: 200 });
    const connector = await freshConnector();
    await connector.match({ name: "Acme International Holding" });
    await connector.match({ name: "Autre Entite Fictive" });
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
  });

  it("panne HTTP : statut « indisponible », ni exception ni faux « aucune correspondance »", async () => {
    mocks.fetchJson.mockResolvedValue({ data: { error: "boom" }, status: 500 });
    const res = await (await freshConnector()).match({ name: "Acme" });
    const raw = res.raw as Record<string, unknown>;
    expect(raw.status).toBe("indisponible");
    expect(raw.matches).toEqual([]);
    expect(res.httpStatus).toBe(500);
    expect(res.isFixture).toBe(false);
    expect(mocks.captureMessage).toHaveBeenCalled();
  });

  it("panne réseau : ne lève jamais et le signale", async () => {
    mocks.fetchJson.mockRejectedValue(new Error("ECONNRESET"));
    const res = await (await freshConnector()).match({ name: "Acme" });
    expect((res.raw as Record<string, unknown>).status).toBe("indisponible");
    expect(res.httpStatus).toBe(0);
    expect(res.endpoint).toContain("(exception)");
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("schéma non reconnu : screening non effectué, signalé", async () => {
    mocks.fetchJson.mockResolvedValue({ data: { inattendu: true }, status: 200 });
    const res = await (await freshConnector()).match({ name: "Acme" });
    expect((res.raw as Record<string, unknown>).status).toBe("schema_inconnu");
    expect(mocks.captureMessage).toHaveBeenCalled();
  });

  it("partage un seul téléchargement entre appels concurrents (démarrage à froid)", async () => {
    let release: (v: { data: unknown; status: number }) => void = () => {};
    mocks.fetchJson.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const connector = await freshConnector();
    const pending = Promise.all([
      connector.match({ name: "Acme International Holding" }),
      connector.match({ name: "Autre Entite Fictive" }),
      connector.match({ name: "Troisieme Societe" }),
    ]);
    release({ data: publication, status: 200 });
    const results = await pending;
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
    expect(results.every((r) => (r.raw as { status: string }).status === "ok")).toBe(true);
  });

  it("un échec n'est pas figé : l'appel suivant retente le téléchargement", async () => {
    mocks.fetchJson.mockRejectedValueOnce(new Error("ECONNRESET"));
    mocks.fetchJson.mockResolvedValueOnce({ data: publication, status: 200 });
    const connector = await freshConnector();
    const first = await connector.match({ name: "Acme International Holding" });
    const second = await connector.match({ name: "Acme International Holding" });
    expect((first.raw as { status: string }).status).toBe("indisponible");
    expect((second.raw as { status: string }).status).toBe("ok");
    expect(mocks.fetchJson).toHaveBeenCalledTimes(2);
  });

  it("marque les consultations dégradées dans l'endpoint (santé de la source)", async () => {
    const { isDegradedEndpoint } = await import("@/lib/connectors/degraded");
    const connector = await freshConnector();

    mocks.fetchJson.mockResolvedValueOnce({ data: { inattendu: true }, status: 200 });
    const schema = await connector.match({ name: "Acme" });
    expect(schema.httpStatus).toBe(200);
    expect(isDegradedEndpoint(schema.endpoint)).toBe(true);

    mocks.fetchJson.mockResolvedValueOnce({ data: { error: "x" }, status: 500 });
    const http = await connector.match({ name: "Acme" });
    expect(isDegradedEndpoint(http.endpoint)).toBe(true);

    mocks.fetchJson.mockRejectedValueOnce(new Error("boom"));
    const network = await connector.match({ name: "Acme" });
    expect(isDegradedEndpoint(network.endpoint)).toBe(true);
  });

  it("n'ajoute aucun secret à l'endpoint enregistré", async () => {
    mocks.fetchJson.mockResolvedValue({ data: publication, status: 200 });
    const res = await (await freshConnector()).match({ name: "Acme" });
    expect(res.endpoint).toBe(
      "https://gels.test/api/v1/publication/derniere-publication-flux-json",
    );
  });
});
