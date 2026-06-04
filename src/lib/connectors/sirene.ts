import { env, hasSireneKey, isDemoMode } from "@/lib/env";
import { fetchJson, RateLimiter } from "./http";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";
import searchFixture from "@/lib/fixtures/sirene-search.sample.json";
import type { ConnectorResult } from "./types";

// Source unique de vérité pour le header (vérifier la casse exacte sur le portail INSEE).
const HEADER = "X-INSEE-Api-Key-Integration";
const limiter = new RateLimiter(28, 60_000); // marge sous le quota de 30 req/min

function shouldMock(): boolean {
  return isDemoMode() || !hasSireneKey();
}

function authHeaders(): Record<string, string> {
  return { [HEADER]: env.INSEE_SIRENE_API_KEY ?? "" };
}

export const sirene = {
  async getUniteLegale(siren: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: uniteLegaleFixture,
        endpoint: "fixture:sirene-unite-legale",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const endpoint = `${env.INSEE_SIRENE_BASE_URL}/siren/${siren}`;
    const { data, status } = await fetchJson(endpoint, {
      headers: authHeaders(),
      limiter,
    });
    return { raw: data, endpoint, httpStatus: status, isFixture: false };
  },

  async getEtablissementSiege(
    siren: string,
    nic?: string | null,
  ): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: etablissementFixture,
        endpoint: "fixture:sirene-etablissement",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const endpoint = nic
      ? `${env.INSEE_SIRENE_BASE_URL}/siret/${siren}${nic}`
      : `${env.INSEE_SIRENE_BASE_URL}/siret?q=${encodeURIComponent(
          `siren:${siren} AND etablissementSiege:true`,
        )}&nombre=1`;
    const { data, status } = await fetchJson(endpoint, {
      headers: authHeaders(),
      limiter,
    });
    return { raw: data, endpoint, httpStatus: status, isFixture: false };
  },

  async search(q: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: searchFixture,
        endpoint: "fixture:sirene-search",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const digits = q.replace(/\s/g, "");
    // Recherche par nom : le champ `raisonSociale` (et non `denominationUniteLegale`,
    // qui renvoie HTTP 400 dans la syntaxe `q` de l'API V3.11) ; dénominations
    // stockées en majuscules → on met le terme en capitales.
    const query = /^\d{9}$/.test(digits)
      ? `siren:${digits}`
      : `raisonSociale:"${q.trim().toUpperCase()}"`;
    const endpoint = `${env.INSEE_SIRENE_BASE_URL}/siren?q=${encodeURIComponent(
      query,
    )}&nombre=20`;
    const { data, status } = await fetchJson(endpoint, {
      headers: authHeaders(),
      limiter,
    });
    return { raw: data, endpoint, httpStatus: status, isFixture: false };
  },
};
