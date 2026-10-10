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
    DILA_JO_BASE_URL: "https://dila.test",
    BOAMP_BASE_URL: "https://boamp.test",
  },
  isDemoMode: () => false,
  isBaloEnabled: () => true,
  isBoampEnabled: () => true,
  isDcaEnabled: () => true,
  isJoafeEnabled: () => true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { balo, humanizeBaloCategory } from "@/lib/connectors/balo";
import { boamp } from "@/lib/connectors/boamp";
import { dca, joafe, isRna } from "@/lib/connectors/associations";
import { odsLiteral, decodeEntities } from "@/lib/connectors/opendatasoft";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
const page = (results: unknown[], total = results.length) => ({ total_count: total, results });
const lastUrl = (fetchMock: ReturnType<typeof vi.fn>) =>
  decodeURIComponent(String(fetchMock.mock.calls.at(-1)?.[0]).replace(/\+/g, " "));

describe("opendatasoft helpers", () => {
  it("échappe les guillemets et antislashs d'un littéral ODSQL", () => {
    expect(odsLiteral("552081317")).toBe('"552081317"');
    expect(odsLiteral('a"b')).toBe('"a\\"b"');
    expect(odsLiteral("a\\b")).toBe('"a\\\\b"');
  });
  it("décode les entités HTML laissées par BOAMP", () => {
    expect(decodeEntities("Commune d&#039;Oloron &amp; Cie")).toBe("Commune d'Oloron & Cie");
  });
  it("RNA : « W » + 9 chiffres uniquement", () => {
    expect(isRna("W172011388")).toBe(true);
    for (const bad of ["", null, undefined, "W12", "172011388", 'W1" or 1=1']) {
      expect(isRna(bad as string)).toBe(false);
    }
  });
  it("humanise les catégories BALO", () => {
    expect(humanizeBaloCategory("PUBLICATIONS PERIODIQUES##Comptes annuels")).toBe(
      "Publications periodiques — Comptes annuels",
    );
    expect(humanizeBaloCategory("AVIS DE CONVOCATION/AVIS DE REUNION##")).toBe(
      "Avis de convocation/avis de reunion",
    );
    expect(humanizeBaloCategory(null)).toBeNull();
  });
});

describe("balo.bySiren", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    mocks.captureException.mockReset();
    mocks.captureMessage.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("interroge le jeu `balo` par SIREN exact et simplifie les annonces", async () => {
    fetchMock.mockResolvedValue(
      reply(
        200,
        page(
          [
            {
              id_annonce: "20260803260331192",
              dateparution: "2026-08-03",
              societes_noms: ["EXEMPLE SA", "AUTRE SAS"],
              siren: ["552081317", "811475383"],
              numero_affaire: 2603311,
              facette_categorie_libelle: "PUBLICATIONS PERIODIQUES##Comptes annuels",
            },
          ],
          101,
        ),
      ),
    );
    const res = await balo.bySiren("552081317");
    const url = lastUrl(fetchMock);
    expect(url).toContain("https://dila.test/api/explore/v2.1/catalog/datasets/balo/records");
    expect(url).toContain('siren="552081317"');
    expect(res.httpStatus).toBe(200);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
    const raw = res.raw as { total: number; items: { otherSirens: string[]; numero: string; names: string[] }[] };
    expect(raw.total).toBe(101); // total réel, liste plafonnée
    expect(raw.items[0].otherSirens).toEqual(["811475383"]); // le sujet est exclu
    expect(raw.items[0].numero).toBe("2603311");
    expect(raw.items[0].names).toEqual(["EXEMPLE SA", "AUTRE SAS"]);
  });

  it("aucune annonce : absence avérée (200), pas une panne", async () => {
    fetchMock.mockResolvedValue(reply(200, page([], 0)));
    const res = await balo.bySiren("123456782");
    expect((res.raw as { status: string; total: number }).status).toBe("ok");
    expect((res.raw as { total: number }).total).toBe(0);
    expect(isDegradedEndpoint(res.endpoint)).toBe(false);
  });

  it("429 puis succès : une seule nouvelle tentative", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(429, "slow down", { "retry-after": "0.01" }))
      .mockResolvedValueOnce(reply(200, page([])));
    const res = await balo.bySiren("552081317");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.httpStatus).toBe(200);
  });

  it("5xx, corps non JSON, schéma inattendu, panne réseau : dégradé, jamais « aucune annonce »", async () => {
    fetchMock.mockResolvedValueOnce(reply(503, "maintenance"));
    const http = await balo.bySiren("552081317");
    expect(http.httpStatus).toBe(503);
    expect(isDegradedEndpoint(http.endpoint)).toBe(true);
    expect((http.raw as { status: string }).status).toBe("indisponible");

    fetchMock.mockResolvedValueOnce(reply(200, "<html>"));
    expect(isDegradedEndpoint((await balo.bySiren("552081317")).endpoint)).toBe(true);

    fetchMock.mockResolvedValueOnce(reply(200, { inattendu: true }));
    expect(isDegradedEndpoint((await balo.bySiren("552081317")).endpoint)).toBe(true);

    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const net = await balo.bySiren("552081317");
    expect(net.httpStatus).toBe(0);
    expect(isDegradedEndpoint(net.endpoint)).toBe(true);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("boamp.bySiren", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ne retient que les avis de RÉSULTAT et nettoie les libellés", async () => {
    fetchMock.mockResolvedValue(
      reply(
        200,
        page(
          [
            {
              idweb: "26-97004",
              dateparution: "2026-09-24",
              nomacheteur: "Commune d&#039;Oloron Ste-Marie",
              titulaire: ["ELECTRICITE DE FRANCE", "SELFEE", "ELECTRICITE DE FRANCE"],
              objet: "Fourniture d&#039;électricité",
              url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:26-97004",
            },
          ],
          25,
        ),
      ),
    );
    const res = await boamp.bySiren("552081317");
    const url = lastUrl(fetchMock);
    expect(url).toContain("https://boamp.test/api/explore/v2.1/catalog/datasets/boamp/records");
    expect(url).toContain('donnees like "%552081317%"');
    expect(url).toContain('nature_libelle="Résultat de marché"');
    const raw = res.raw as { total: number; items: { buyer: string; titulaires: string[]; object: string }[] };
    expect(raw.total).toBe(25);
    expect(raw.items[0].buyer).toBe("Commune d'Oloron Ste-Marie");
    expect(raw.items[0].titulaires).toEqual(["ELECTRICITE DE FRANCE", "SELFEE"]); // dédoublonné
    expect(raw.items[0].object).toBe("Fourniture d'électricité");
  });

  it("erreur HTTP : dégradé", async () => {
    fetchMock.mockResolvedValue(reply(500, {}));
    const res = await boamp.bySiren("552081317");
    expect(isDegradedEndpoint(res.endpoint)).toBe(true);
  });
});

describe("dca / joafe", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("DCA : filtre source=dca et dca_siren, expose le RNA lu", async () => {
    fetchMock.mockResolvedValue(
      reply(
        200,
        page(
          [
            {
              id: "448684001_31122025",
              source: "dca",
              numero_rna: "W751000001",
              dca_datecloture: "2025-12-31T12:00:00+00:00",
              dca_datevalidation: "2026-03-02T10:00:00+00:00",
              association_type_libelle: "Associations loi du 1er juillet 1901",
            },
          ],
          7,
        ),
      ),
    );
    const res = await dca.bySiren("448684001");
    const url = lastUrl(fetchMock);
    expect(url).toContain('source="dca" and dca_siren="448684001"');
    const raw = res.raw as { total: number; rna: string; items: { closedOn: string; date: string }[] };
    expect(raw.total).toBe(7);
    expect(raw.rna).toBe("W751000001");
    expect(raw.items[0]).toMatchObject({ closedOn: "2025-12-31", date: "2026-03-02" });
  });

  it("JOAFE : filtre source=joafe et numero_rna ; RNA invalide → aucune requête", async () => {
    fetchMock.mockResolvedValue(
      reply(
        200,
        page([
          {
            id: "202600400414",
            source: "joafe",
            dateparution: "2026-10-06",
            numero_rna: "W172011388",
            typeavis: "Création",
            etatavis: "Initial",
            association_type_libelle: "Associations loi du 1er juillet 1901",
            titre: "L'AIR DES FIL'LES",
          },
        ]),
      ),
    );
    const res = await joafe.byRna("W172011388");
    expect(lastUrl(fetchMock)).toContain('source="joafe" and numero_rna="W172011388"');
    expect((res.raw as { items: { type: string }[] }).items[0].type).toBe("Création");

    fetchMock.mockClear();
    const bad = await joafe.byRna('W1" or 1=1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect((bad.raw as { total: number }).total).toBe(0);
  });
});
