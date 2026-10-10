import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/connectors/http", () => ({
  fetchJson: mocks.fetchJson,
  RateLimiter: class {
    async wait() {}
  },
}));
vi.mock("@/lib/env", () => ({
  env: { GLEIF_BASE_URL: "https://gleif.test/api/v1" },
  isDemoMode: () => false,
  isGleifEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: vi.fn(),
}));

import { gleif, sirenVariants } from "@/lib/connectors/gleif";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";

const SIREN = "775670284";
const SPACED = "775 670 284";

const rec = (lei: string, name: string, registeredAs: string, ra: string, country = "FR") => ({
  id: lei,
  attributes: {
    lei,
    entity: {
      legalName: { name },
      legalAddress: { country },
      registeredAs,
      registeredAt: { id: ra },
    },
  },
});

type Handler = () => { data: unknown; status: number } | Promise<never>;

/** Route les appels `fetchJson` selon l'URL (recherche par graphie, ou mère). */
function route(handlers: {
  plain?: Handler;
  spaced?: Handler;
  direct?: Handler;
  ultimate?: Handler;
}) {
  const none = () => ({ data: { data: [] }, status: 200 });
  mocks.fetchJson.mockImplementation((url: string) => {
    const u = decodeURIComponent(String(url));
    if (u.includes(`registeredAs]=${SPACED}`)) return Promise.resolve((handlers.spaced ?? none)());
    if (u.includes(`registeredAs]=${SIREN}`)) return Promise.resolve((handlers.plain ?? none)());
    if (u.endsWith("/direct-parent"))
      return Promise.resolve((handlers.direct ?? (() => ({ data: null, status: 404 })))());
    if (u.endsWith("/ultimate-parent"))
      return Promise.resolve((handlers.ultimate ?? (() => ({ data: null, status: 404 })))());
    return Promise.resolve({ data: null, status: 404 });
  });
}

const reject = (msg = "ECONNRESET"): Handler => () => Promise.reject(new Error(msg)) as Promise<never>;

describe("sirenVariants", () => {
  it("renvoie la forme brute ET la forme avec espaces d'un SIREN valide", () => {
    expect(sirenVariants("775670284")).toEqual(["775670284", "775 670 284"]);
    expect(sirenVariants("775 670 284")).toEqual(["775670284", "775 670 284"]);
  });
  it("laisse une valeur non SIREN telle quelle", () => {
    expect(sirenVariants("abc")).toEqual(["abc"]);
  });
});

describe("gleif.bySiren (live)", () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.captureException.mockReset();
  });

  it("trouve une entité enregistrée SANS espaces (forme brute)", async () => {
    route({
      plain: () => ({ data: { data: [rec("LEI-PLAIN", "DANONE", "552032534", "RA000189")] }, status: 200 }),
    });
    const res = await gleif.bySiren(SIREN);
    const raw = res.raw as { subject: { lei: string } | null };
    expect(raw.subject?.lei).toBe("LEI-PLAIN");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("trouve une entité enregistrée AVEC espaces (EDF, HSBC…) et capte la mère britannique", async () => {
    route({
      spaced: () => ({
        data: { data: [rec("LEI-HSBC", "HSBC CONTINENTAL EUROPE", SPACED, "RA000192")] },
        status: 200,
      }),
      direct: () => ({
        data: { data: rec("LEI-BANK", "HSBC BANK PLC", "00014259", "RA000585", "GB") },
        status: 200,
      }),
      ultimate: () => ({
        data: { data: rec("LEI-HOLD", "HSBC HOLDINGS PLC", "00617987", "RA000585", "GB") },
        status: 200,
      }),
    });
    const res = await gleif.bySiren(SIREN);
    const raw = res.raw as {
      subject: { lei: string; registeredAs: string } | null;
      directParent: { lei: string; registeredAs: string; registrationAuthority: string } | null;
      ultimateParent: { lei: string; registrationAuthority: string } | null;
    };
    expect(raw.subject?.lei).toBe("LEI-HSBC");
    expect(raw.subject?.registeredAs).toBe(SPACED);
    expect(raw.directParent).toMatchObject({
      lei: "LEI-BANK",
      registeredAs: "00014259",
      registrationAuthority: "RA000585",
    });
    expect(raw.ultimateParent?.registrationAuthority).toBe("RA000585");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("aucune entité sous aucune graphie : absence avérée (pas une panne)", async () => {
    route({});
    const res = await gleif.bySiren(SIREN);
    expect((res.raw as { subject: unknown }).subject).toBeNull();
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
    // Aucune requête « mère » sans entité.
    const parentCalls = mocks.fetchJson.mock.calls.filter((c) => /parent$/.test(String(c[0])));
    expect(parentCalls).toHaveLength(0);
  });

  it("une graphie en échec ne masque pas l'autre qui trouve l'entité", async () => {
    route({
      plain: reject(),
      spaced: () => ({ data: { data: [rec("LEI-EDF", "ELECTRICITE DE FRANCE", "552 081 317", "RA000192")] }, status: 200 }),
    });
    const res = await gleif.bySiren(SIREN);
    expect((res.raw as { subject: { lei: string } | null }).subject?.lei).toBe("LEI-EDF");
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("une graphie en échec et l'autre vide : consultation dégradée, jamais « pas de LEI »", async () => {
    route({ plain: reject() });
    const res = await gleif.bySiren(SIREN);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });

  it("graphie brute vide (200) ET graphie à espaces en 429 : dégradé, jamais « pas de LEI »", async () => {
    route({ spaced: () => ({ data: { error: "rate limit" }, status: 429 }) });
    const res = await gleif.bySiren(SIREN);
    expect((res.raw as { subject: unknown }).subject).toBeNull();
    expect(res.httpStatus).toBe(429);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(res.endpoint).toContain("(erreur 429)");
  });

  it("graphie brute en 5xx ET graphie à espaces vide : dégradé avec le statut de l'échec", async () => {
    route({ plain: () => ({ data: {}, status: 503 }) });
    const res = await gleif.bySiren(SIREN);
    expect(res.httpStatus).toBe(503);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });

  it("deux graphies en 429 : dégradé 429", async () => {
    route({
      plain: () => ({ data: {}, status: 429 }),
      spaced: () => ({ data: {}, status: 429 }),
    });
    const res = await gleif.bySiren(SIREN);
    expect(res.httpStatus).toBe(429);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });

  it("une graphie en 5xx n'empêche pas l'autre de trouver le LEI (consultation saine)", async () => {
    route({
      plain: () => ({ data: {}, status: 500 }),
      spaced: () => ({
        data: { data: [rec("LEI-HSBC", "HSBC CONTINENTAL EUROPE", SPACED, "RA000192")] },
        status: 200,
      }),
    });
    const res = await gleif.bySiren(SIREN);
    expect((res.raw as { subject: { lei: string } | null }).subject?.lei).toBe("LEI-HSBC");
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("l'endpoint enregistré est celui de la requête qui a produit le LEI", async () => {
    // Graphie à espaces gagnante : l'URL doit contenir « 775 670 284 », pas la brute.
    route({
      spaced: () => ({
        data: { data: [rec("LEI-HSBC", "HSBC CONTINENTAL EUROPE", SPACED, "RA000192")] },
        status: 200,
      }),
    });
    const spaced = await gleif.bySiren(SIREN);
    expect(decodeURIComponent(spaced.endpoint)).toContain(`registeredAs]=${SPACED}`);
    expect(spaced.endpoint).not.toMatch(/registeredAs\]=775670284$/);

    // Graphie brute gagnante : l'URL brute.
    route({
      plain: () => ({ data: { data: [rec("LEI-PLAIN", "DANONE", "552032534", "RA000189")] }, status: 200 }),
    });
    const plain = await gleif.bySiren(SIREN);
    expect(plain.endpoint).toMatch(/registeredAs\]=775670284$/);
  });

  it("absence avérée (les deux graphies 200 vides) : endpoint de la 1ʳᵉ graphie, non dégradé", async () => {
    route({});
    const res = await gleif.bySiren(SIREN);
    expect(res.endpoint).toMatch(/registeredAs\]=775670284$/);
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("toutes les requêtes en échec : exception explicite, ne lève jamais", async () => {
    route({ plain: reject(), spaced: reject() });
    const res = await gleif.bySiren(SIREN);
    expect(res.httpStatus).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("mère non récupérée (429) : dégradé ; 404 = aucune mère, normal", async () => {
    const found = {
      spaced: () => ({ data: { data: [rec("LEI-X", "X SA", SPACED, "RA000192")] }, status: 200 }),
    };
    route({ ...found, direct: () => ({ data: { error: "rate" }, status: 429 }) });
    const limited = await gleif.bySiren(SIREN);
    expect(isDegradedEndpoint(limited.endpoint)).toBe(true);
    expect((limited.raw as { subject: { lei: string } }).subject.lei).toBe("LEI-X");

    route({ ...found });
    const ok = await gleif.bySiren(SIREN);
    expect(isDegradedEndpoint(ok.endpoint)).toBe(false);
    expect((ok.raw as { directParent: unknown }).directParent).toBeNull();
  });
});
