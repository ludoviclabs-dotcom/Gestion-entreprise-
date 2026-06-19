import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isGleifEnabled } from "@/lib/env";
import { fetchJson, RateLimiter } from "./http";
import gleifFixture from "@/lib/fixtures/gleif.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur GLEIF (Global Legal Entity Identifier Foundation).
 *
 * Référentiel LEI ouvert (licence CC0, sans authentification). Sert la
 * structure de détention TRANSFRONTALIÈRE : à partir du SIREN sujet, on
 * retrouve son LEI (`entity.registeredAs`), puis ses sociétés mères de
 * consolidation de niveau 2 (mère directe + mère ultime).
 *
 * ⚠️ GLEIF ne publie PAS de pourcentage de détention (ce sont des relations de
 * consolidation comptable, pas des participations chiffrées). Les arêtes
 * `DETIENT` issues de GLEIF sont donc STRUCTURELLES (sans %), `declared` :
 * elles enrichissent le graphe et les règles structurelles, mais ne pèsent pas
 * dans la cascade `computeUbo` (qui ignore les arêtes sans % exploitable).
 *
 * Modes (calqués sur tresor-gels) :
 *  - démo / flag absent → fixture (LEI DANONE, sans mère).
 *  - live OK → données réelles (isFixture:false) ; LEI absent = cas normal
 *    (beaucoup de PME n'ont pas de LEI) → résultat vide silencieux.
 *  - live en erreur → résultat vide + capture Sentry. Ne lève jamais.
 */

export type GleifEntityLite = {
  lei: string;
  legalName: string | null;
  country: string | null;
};
export type GleifSimplified = {
  subject: (GleifEntityLite & { registeredAs: string | null }) | null;
  directParent: GleifEntityLite | null;
  ultimateParent: GleifEntityLite | null;
};

const limiter = new RateLimiter(50, 60_000);

function shouldMock(): boolean {
  return isDemoMode() || !isGleifEnabled();
}

type LeiRecord = {
  id?: string;
  attributes?: {
    lei?: string;
    entity?: {
      legalName?: { name?: string } | null;
      legalAddress?: { country?: string } | null;
      registeredAs?: string | null;
    } | null;
  };
};

function liteFrom(rec: LeiRecord | undefined | null): GleifEntityLite | null {
  const lei = rec?.attributes?.lei ?? rec?.id;
  if (!lei) return null;
  return {
    lei,
    legalName: rec?.attributes?.entity?.legalName?.name ?? null,
    country: rec?.attributes?.entity?.legalAddress?.country ?? null,
  };
}

async function fetchParent(
  base: string,
  lei: string,
  rel: "direct-parent" | "ultimate-parent",
): Promise<GleifEntityLite | null> {
  try {
    const { data, status } = await fetchJson<{ data?: LeiRecord | null }>(
      `${base}/lei-records/${lei}/${rel}`,
      { limiter },
    );
    // 404 = aucune mère reportée pour ce niveau (cas normal, pas une erreur).
    if (status === 404 || !data?.data) return null;
    return liteFrom(data.data);
  } catch {
    return null; // mère absente / réseau → silencieux, n'interrompt pas l'assemblage.
  }
}

export const gleif = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: gleifFixture,
        endpoint: `fixture:gleif:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const base = env.GLEIF_BASE_URL;
    const searchUrl = `${base}/lei-records?filter[entity.registeredAs]=${encodeURIComponent(
      siren,
    )}`;
    try {
      const { data, status } = await fetchJson<{ data?: LeiRecord[] }>(searchUrl, {
        limiter,
      });
      const rec = data?.data?.[0];
      const lite = liteFrom(rec);
      const subject = lite
        ? { ...lite, registeredAs: rec?.attributes?.entity?.registeredAs ?? siren }
        : null;
      const [directParent, ultimateParent] = subject
        ? await Promise.all([
            fetchParent(base, subject.lei, "direct-parent"),
            fetchParent(base, subject.lei, "ultimate-parent"),
          ])
        : [null, null];
      const raw: GleifSimplified = { subject, directParent, ultimateParent };
      return { raw, endpoint: searchUrl, httpStatus: status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return {
        raw: { subject: null, directParent: null, ultimateParent: null },
        endpoint: `${searchUrl} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};
