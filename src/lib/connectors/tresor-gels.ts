import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isTresorGelsEnabled } from "@/lib/env";
import { fetchJson } from "./http";
import gelsFixture from "@/lib/fixtures/tresor-gels.sample.json";
import {
  extractGelsEntries,
  matchGelsEntries,
  type GelsExtraction,
} from "./tresor-gels-match";
import type { ConnectorResult } from "./types";

/**
 * Connecteur DG Trésor — Registre national des gels.
 *
 * API publique sans clé, mais :
 *  - un User-Agent est OBLIGATOIRE depuis le 21/01/2025 ;
 *  - la publication complète pèse plus de 10 Mo : on la télécharge côté serveur,
 *    on la garde en cache mémoire 6 h, et on ne persiste QUE les correspondances
 *    (jamais le fichier : il saturerait source_records à chaque dossier).
 *
 * Modes (inchangés) : démo / flag absent → fixture ; live → rapprochement réel.
 * Live en échec → résultat vide `status: "indisponible"` + Sentry. Ne lève jamais :
 * une panne de ce flux ne doit pas bloquer la création du dossier, mais elle ne
 * doit pas non plus se lire comme « aucune correspondance » (cf. `raw.status`).
 */

const USER_AGENT = "KYB-Graph/1.0 (screening gels des avoirs)";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 45_000;

type CachedPublication = {
  endpoint: string;
  at: number;
  httpStatus: number;
  extraction: GelsExtraction;
};
let cache: CachedPublication | null = null;

export type TresorGelsRaw = {
  status: "ok" | "schema_inconnu" | "indisponible";
  publicationDate: string | null;
  entriesCount: number;
  matches: ReturnType<typeof matchGelsEntries>;
  query: { siren?: string; name?: string };
};

async function loadPublication(endpoint: string): Promise<CachedPublication> {
  if (cache && cache.endpoint === endpoint && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache;
  }
  const { data, status } = await fetchJson<unknown>(endpoint, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  const loaded: CachedPublication = {
    endpoint,
    at: Date.now(),
    httpStatus: status,
    extraction:
      status >= 200 && status < 300
        ? extractGelsEntries(data)
        : { status: "schema_inconnu", publicationDate: null, entries: [] },
  };
  // Une réponse en erreur n'est jamais mise en cache.
  if (status >= 200 && status < 300 && loaded.extraction.status === "ok") {
    cache = loaded;
  }
  return loaded;
}

export const tresorGels = {
  async match(params: {
    siren?: string;
    name?: string;
  }): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isTresorGelsEnabled()) {
      return {
        raw: gelsFixture,
        endpoint: "fixture:tresor-gels",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const endpoint = `${env.TRESOR_GELS_BASE_URL}/publication/derniere-publication-flux-json`;
    const query = { siren: params.siren, name: params.name };
    const unavailable = (
      status: TresorGelsRaw["status"],
      httpStatus: number,
      suffix: string,
    ): ConnectorResult<unknown> => ({
      raw: {
        status,
        publicationDate: null,
        entriesCount: 0,
        matches: [],
        query,
      } satisfies TresorGelsRaw,
      endpoint: `${endpoint}${suffix}`,
      httpStatus,
      isFixture: false,
    });

    try {
      const loaded = await loadPublication(endpoint);
      if (loaded.httpStatus < 200 || loaded.httpStatus >= 300) {
        Sentry.captureMessage(`DG Trésor gels: HTTP ${loaded.httpStatus}`, "warning");
        return unavailable("indisponible", loaded.httpStatus, ` (erreur ${loaded.httpStatus})`);
      }
      if (loaded.extraction.status !== "ok") {
        Sentry.captureMessage(
          "DG Trésor gels: structure du flux non reconnue — screening non effectué",
          "warning",
        );
        return unavailable("schema_inconnu", loaded.httpStatus, " (schéma non reconnu)");
      }
      const { extraction } = loaded;
      const raw: TresorGelsRaw = {
        status: "ok",
        publicationDate: extraction.publicationDate,
        entriesCount: extraction.entries.length,
        matches: matchGelsEntries(extraction.entries, { name: params.name }),
        query,
      };
      return { raw, endpoint, httpStatus: loaded.httpStatus, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return unavailable("indisponible", 0, " (exception)");
    }
  },
};
