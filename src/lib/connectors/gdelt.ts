import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isGdeltEnabled } from "@/lib/env";
import { fetchJson, RateLimiter } from "./http";
import gdeltFixture from "@/lib/fixtures/gdelt.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur GDELT (presse / adverse media) — API DOC 2.0 ouverte, sans clé.
 *
 * Interroge la presse mondiale par nom d'entité. Architecture COMPUTE-FIRST :
 * la donnée (articles) vient de la source ; aucune génération narrative non
 * sourcée. L'appariement au graphe + le faisceau se font côté normalisation.
 *
 * Modes (calqués sur les connecteurs opt-in) :
 *  - démo / flag absent → fixture.
 *  - live OK → données réelles.
 *  - live en erreur → liste vide + capture Sentry. Ne lève jamais.
 */

const limiter = new RateLimiter(20, 60_000);

function shouldMock(): boolean {
  return isDemoMode() || !isGdeltEnabled();
}

export const gdelt = {
  async byName(name: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: gdeltFixture,
        endpoint: `fixture:gdelt:${name}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const query = encodeURIComponent(`"${name}"`);
    const endpoint = `${env.GDELT_BASE_URL}/doc/doc?query=${query}&mode=artlist&format=json&maxrecords=25&sort=hybridrel`;
    try {
      const { data, status } = await fetchJson<{ articles?: unknown[] }>(endpoint, {
        limiter,
      });
      return { raw: data, endpoint, httpStatus: status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return {
        raw: { articles: [] },
        endpoint: `${endpoint} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};
