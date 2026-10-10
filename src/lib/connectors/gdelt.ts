import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isGdeltEnabled } from "@/lib/env";
import { RateLimiter } from "./http";
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
      Sentry.captureException(error);
      return degraded(0, "(exception)");
    }
  },
};
