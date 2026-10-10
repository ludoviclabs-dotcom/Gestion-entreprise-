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
  /** N° d'immatriculation au registre d'origine (`entity.registeredAs`). */
  registeredAs?: string | null;
  /** Code RA GLEIF du registre (`entity.registeredAt.id`, ex. RA000585). */
  registrationAuthority?: string | null;
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
      registeredAt?: { id?: string | null } | null;
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
    registeredAs: rec?.attributes?.entity?.registeredAs ?? null,
    registrationAuthority: rec?.attributes?.entity?.registeredAt?.id ?? null,
  };
}

type ParentOutcome = {
  lite: GleifEntityLite | null;
  /** Suffixe d'endpoint si la consultation a ÉCHOUÉ (≠ absence de mère). */
  failure: string | null;
};

async function fetchParent(
  base: string,
  lei: string,
  rel: "direct-parent" | "ultimate-parent",
): Promise<ParentOutcome> {
  try {
    const { data, status } = await fetchJson<{ data?: LeiRecord | null }>(
      `${base}/lei-records/${lei}/${rel}`,
      { limiter },
    );
    // 404 = aucune mère reportée pour ce niveau (cas normal, pas une erreur).
    if (status === 404) return { lite: null, failure: null };
    // Autre erreur HTTP (429, 5xx…) : on ne sait PAS s'il y a une mère. Ne pas la
    // confondre avec « aucune mère » : la consultation est signalée dégradée.
    if (status < 200 || status >= 300) {
      return { lite: null, failure: `(erreur ${status})` };
    }
    if (!data?.data) return { lite: null, failure: null };
    return { lite: liteFrom(data.data), failure: null };
  } catch {
    return { lite: null, failure: "(exception)" };
  }
}

type SearchResponse = { data?: { data?: LeiRecord[] } | null; status: number };
type VariantOutcome = {
  url: string;
  /** null = la requête a levé (réseau, délai dépassé). */
  response: SearchResponse | null;
};

function isOk(r: SearchResponse | null): r is SearchResponse {
  return r !== null && r.status >= 200 && r.status < 300;
}

/**
 * Choisit le résultat parmi les graphies interrogées.
 *  - une graphie 2xx qui TROUVE un LEI l'emporte (l'échec de l'autre importe peu) ;
 *  - sinon, si toutes ont répondu 2xx sans LEI : absence avérée ;
 *  - sinon (une graphie en échec — HTTP 429/5xx ou exception — sans LEI trouvé) :
 *    on ne peut PAS conclure à l'absence → résultat dégradé, avec le statut de
 *    l'échec pour qu'il compte dans la santé de la source ;
 *  - toutes en exception → `null` (l'appelant lève).
 */
function selectVariant(outcomes: VariantOutcome[]): {
  chosen: VariantOutcome;
  failure: string | null;
  status: number;
} | null {
  const hit = outcomes.find((o) => isOk(o.response) && o.response.data?.data?.[0]);
  if (hit && hit.response) {
    return { chosen: hit, failure: null, status: hit.response.status };
  }
  const failed = outcomes.filter((o) => !isOk(o.response));
  if (failed.length === 0) {
    const first = outcomes[0];
    return { chosen: first, failure: null, status: first.response?.status ?? 200 };
  }
  const httpFailure = failed.find((o) => o.response !== null);
  if (httpFailure?.response) {
    return {
      chosen: httpFailure,
      failure: `(erreur ${httpFailure.response.status})`,
      status: httpFailure.response.status,
    };
  }
  const answered = outcomes.find((o) => isOk(o.response));
  if (!answered?.response) return null;
  return { chosen: answered, failure: "(exception)", status: answered.response.status };
}

/**
 * GLEIF stocke un SIREN français sous DEUX formes selon l'entité : « 552032534 »
 * (registre RA000189) ou « 552 081 317 » avec espaces (ex. RA000192). Les deux
 * sont interrogées, sinon des sociétés comme EDF ou HSBC restent introuvables.
 */
export function sirenVariants(siren: string): string[] {
  const digits = siren.replace(/\D/g, "");
  if (digits.length !== 9) return [siren];
  return [digits, `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`];
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
    const urlFor = (v: string) =>
      `${base}/lei-records?filter[entity.registeredAs]=${encodeURIComponent(v)}`;
    const variants = sirenVariants(siren);
    const searchUrl = urlFor(variants[0]);
    try {
      // Les deux graphies en parallèle ; une graphie en échec ne masque pas l'autre.
      const urls = variants.map(urlFor);
      const settled = await Promise.allSettled(
        urls.map((u) => fetchJson<{ data?: LeiRecord[] }>(u, { limiter })),
      );
      const selection = selectVariant(
        settled.map((s, i) => ({
          url: urls[i],
          response: s.status === "fulfilled" ? s.value : null,
        })),
      );
      if (!selection) {
        // Toutes les requêtes ont échoué : vraie panne (pas « LEI absent »).
        throw (settled[0] as PromiseRejectedResult).reason;
      }
      const { chosen, failure: searchFailure, status } = selection;
      // Le corps d'une réponse en erreur n'est jamais lu comme une donnée.
      const rec = isOk(chosen.response) ? chosen.response?.data?.data?.[0] : undefined;
      const lite = liteFrom(rec);
      const subject = lite
        ? { ...lite, registeredAs: rec?.attributes?.entity?.registeredAs ?? siren }
        : null;
      const [direct, ultimate] = subject
        ? await Promise.all([
            fetchParent(base, subject.lei, "direct-parent"),
            fetchParent(base, subject.lei, "ultimate-parent"),
          ])
        : [
            { lite: null, failure: null },
            { lite: null, failure: null },
          ];
      const raw: GleifSimplified = {
        subject,
        directParent: direct.lite,
        ultimateParent: ultimate.lite,
      };
      // Une recherche non concluante (une graphie en échec sans LEI trouvé) ou une
      // mère non récupérée rend la consultation DÉGRADÉE : jamais un « aucune mère »
      // ni un « pas de LEI » présumé.
      const failure = searchFailure ?? direct.failure ?? ultimate.failure;
      // URL de la requête qui a PRODUIT le résultat (reproductible par l'inspecteur).
      return {
        raw,
        endpoint: failure ? `${chosen.url} ${failure}` : chosen.url,
        httpStatus: status,
        isFixture: false,
      };
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
