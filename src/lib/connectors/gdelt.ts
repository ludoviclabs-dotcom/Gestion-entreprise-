import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isGdeltEnabled } from "@/lib/env";
import { RateLimiter } from "./http";
import { isDegradedEndpoint } from "./degraded";
import gdeltFixture from "@/lib/fixtures/gdelt.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur GDELT (presse / adverse media) — API DOC 2.0 ouverte, sans clé.
 *
 * Interroge la presse mondiale par nom d'entité. Architecture COMPUTE-FIRST :
 * la donnée (articles) vient de la source ; aucune génération narrative non
 * sourcée. L'appariement au graphe + le faisceau se font côté normalisation.
 *
 * ⚠️ GDELT n'autorise qu'UNE requête toutes les 5 secondes par IP et répond en
 * texte brut (« Please limit requests… ») avec HTTP 429. Depuis un hébergeur
 * serverless (IP de sortie partagée) ce cas est fréquent : il est traité comme
 * une indisponibilité EXPLICITE (statut 429, endpoint suffixé), pas comme une
 * exception, et jamais comme « aucun article ».
 *
 * ⏱️ GDELT est LENT, y compris pour refuser : mesuré 10 à 14 s par requête (429
 * compris). C'était la quasi-totalité de la durée de création d'un dossier
 * (≈ 22 s dont ≈ 21 s pour GDELT, tout le reste ≈ 1 s). D'où : UNE seule
 * tentative (jamais de nouvel essai sur 429 — il échouait presque toujours aussi)
 * et un délai maximal borné ; au-delà, consultation dégradée « délai dépassé ».
 *
 * 🔁 Reprises (collecte APRÈS la réponse uniquement, `byNameResilient`) : mesuré le
 * 12 octobre 2026, GDELT refuse (429, ≈ 10 s par refus) environ trois requêtes sur
 * quatre MÊME depuis une IP unique espacée de 20 s — c'est une saturation côté
 * GDELT, pas seulement l'IP partagée de l'hébergeur. Une tentative unique échoue
 * donc presque toujours. La collecte différée (qui n'attend personne) retente dans
 * un budget borné ; le chemin synchrone, lui, reste à UNE tentative.
 *
 * Modes (calqués sur les connecteurs opt-in) :
 *  - démo / flag absent → fixture.
 *  - live OK → données réelles.
 *  - live en échec → liste vide + statut dégradé + Sentry. Ne lève jamais.
 */

const GDELT_SPACING_MS = 5_500;
const limiter = new RateLimiter(1, GDELT_SPACING_MS);
const TIMEOUT_MS = 15_000;
const USER_AGENT = "KYB-Graph/1.0 (veille presse)";

function shouldMock(): boolean {
  return isDemoMode() || !isGdeltEnabled();
}

type GdeltPayload = { articles?: unknown[] };

export const gdelt = {
  /** Avec reprises : collecte DIFFÉRÉE seulement (voir `resilient`). */
  byNameResilient(name: string, options?: GdeltRetryOptions): Promise<ConnectorResult<unknown>> {
    return resilient(name, options);
  },
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
    const degraded = (httpStatus: number, suffix: string): ConnectorResult<unknown> => ({
      raw: { articles: [] },
      endpoint: `${endpoint} ${suffix}`,
      httpStatus,
      isFixture: false,
    });

    try {
      // UNE tentative : un 429 immédiat n'est pas rattrapable (la fenêtre de 5 s
      // est partagée avec les autres appelants de la même IP de sortie) et un
      // nouvel essai doublait le délai pour le même résultat.
      await limiter.wait();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      let text: string;
      try {
        res = await fetch(endpoint, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
          signal: controller.signal,
        });
        text = await res.text();
      } catch (error) {
        if (controller.signal.aborted) {
          // Délai dépassé : indisponibilité, pas une anomalie à remonter.
          return degraded(0, "(délai dépassé)");
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (res.status < 200 || res.status >= 300) {
        // 429 attendu en environnement partagé : tracé par le statut, sans bruit.
        if (res.status !== 429) {
          Sentry.captureMessage(`GDELT: HTTP ${res.status}`, "warning");
        }
        return degraded(res.status, `(erreur ${res.status})`);
      }
      try {
        const data = JSON.parse(text) as GdeltPayload;
        if (!data || typeof data !== "object") throw new Error("non-objet");
        return { raw: data, endpoint, httpStatus: res.status, isFixture: false };
      } catch {
        // HTTP 200 mais corps non JSON (message texte de GDELT) : pas un résultat.
        Sentry.captureMessage("GDELT: réponse non JSON", "warning");
        return degraded(res.status, "(schéma non reconnu)");
      }
    } catch (error) {
      // Connexion réinitialisée par GDELT sous charge (« fetch failed », TypeError) :
      // attendu et fréquent (mesuré le 12 oct. 2026), tracé par le statut, sans bruit.
      if (!(error instanceof TypeError)) Sentry.captureException(error);
      return degraded(0, "(exception)");
    }
  },
};

/** Reprises de la collecte différée : bornées en tentatives ET en durée. */
export const GDELT_RETRY = {
  maxAttempts: 6,
  /** Pause entre deux tentatives (en plus du limiteur, `GDELT_SPACING_MS`). */
  pauseMs: 2_000,
  /** Durée totale maximale, tentatives comprises (la route autorise 120 s). */
  budgetMs: 90_000,
};

export type GdeltRetryOptions = Partial<typeof GDELT_RETRY> & {
  /** Injectables pour les tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const isOk = (r: ConnectorResult<unknown>): boolean =>
  r.isFixture || (r.httpStatus >= 200 && r.httpStatus < 300 && !isDegradedEndpoint(r.endpoint));

/**
 * Une tentative vaut d'être reprise si l'échec est transitoire : saturation (429),
 * indisponibilité (5xx), délai dépassé, réponse texte au lieu de JSON, panne
 * réseau. Une autre erreur 4xx (requête refusée) ne se corrige pas en réessayant.
 */
export const isRetryableGdelt = (r: ConnectorResult<unknown>): boolean =>
  !isOk(r) && (r.httpStatus === 0 || r.httpStatus === 429 || r.httpStatus >= 500 || r.httpStatus === 200);

/**
 * Comme `gdelt.byName`, avec reprises. À n'utiliser que hors du chemin de réponse
 * à l'utilisateur. Ne lève jamais. Renvoie la dernière tentative ; `raw.attempts`
 * dit combien ont été nécessaires (preuve conservée avec la charge brute).
 */
async function resilient(
  name: string,
  options: GdeltRetryOptions = {},
): Promise<ConnectorResult<unknown>> {
  const cfg = { ...GDELT_RETRY, ...options };
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const startedAt = now();
  let attempts = 0;
  let last = await gdelt.byName(name);
  attempts++;
  while (
    attempts < cfg.maxAttempts &&
    isRetryableGdelt(last) &&
    now() - startedAt + cfg.pauseMs + TIMEOUT_MS <= cfg.budgetMs
  ) {
    await sleep(cfg.pauseMs);
    last = await gdelt.byName(name);
    attempts++;
  }
  const raw =
    last.raw && typeof last.raw === "object" && !Array.isArray(last.raw)
      ? { ...(last.raw as Record<string, unknown>), attempts }
      : last.raw;
  return { ...last, raw };
}
