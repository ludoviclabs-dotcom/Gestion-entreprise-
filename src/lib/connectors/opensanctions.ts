import * as Sentry from "@sentry/nextjs";
import { env, hasOpenSanctionsKey, isDemoMode } from "@/lib/env";
import { fetchJson } from "./http";
import fixture from "@/lib/fixtures/opensanctions.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur OpenSanctions — base ouverte EU agrégeant des centaines de
 * listes sanctions (UE, OFAC, ONU, gels nationaux) + listes PEP.
 *
 * Mode mock : sans clé OU en demo mode → fixture (1 match simulé score 0.72).
 *
 * API publique : POST `/match/{dataset}` avec un payload de requêtes nommées.
 * Dataset par défaut : `sanctions` (peut être surchargé via env). Token
 * optionnel pour augmenter les quotas (free tier limité).
 */
export type OpenSanctionsQueryInput = {
  schema: "Person" | "Company" | "Organization";
  name: string;
  // Identifiants alternatifs : SIREN/SIRET côté société, dob côté personne.
  identifier?: string;
  birthDate?: string;
};

function shouldMock(): boolean {
  return isDemoMode() || !hasOpenSanctionsKey();
}

export const openSanctions = {
  async match(
    queries: Record<string, OpenSanctionsQueryInput>,
  ): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: fixture,
        endpoint: "fixture:opensanctions",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const url = `${env.OPENSANCTIONS_BASE_URL}/match/${env.OPENSANCTIONS_DATASET}`;
    const body = {
      queries: Object.fromEntries(
        Object.entries(queries).map(([k, q]) => [
          k,
          {
            schema: q.schema,
            properties: {
              name: [q.name],
              ...(q.identifier
                ? { registrationNumber: [q.identifier] }
                : {}),
              ...(q.birthDate ? { birthDate: [q.birthDate] } : {}),
            },
          },
        ]),
      ),
    };
    // Échec : résultat VIDE à la forme attendue (`responses`) + endpoint suffixé,
    // jamais un corps d'erreur lu comme une donnée ni une exception qui ferait
    // échouer tout le dossier (les sources sont appelées en parallèle).
    const degraded = (httpStatus: number, suffix: string): ConnectorResult<unknown> => ({
      raw: { responses: {} },
      endpoint: `${url} ${suffix}`,
      httpStatus,
      isFixture: false,
    });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${env.OPENSANCTIONS_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status < 200 || res.status >= 300) {
        // 401 « Invalid API key », 403 licence, 429 quota…
        Sentry.captureMessage(`OpenSanctions: HTTP ${res.status}`, "warning");
        return degraded(res.status, `(erreur ${res.status})`);
      }
      const data: unknown = await res.json();
      if (!data || typeof data !== "object") {
        return degraded(res.status, "(schéma non reconnu)");
      }
      return {
        raw: data,
        endpoint: url,
        httpStatus: res.status,
        isFixture: false,
      };
    } catch (error) {
      Sentry.captureException(error);
      return degraded(0, "(exception)");
    }
  },
};

// Helper interne pour conformer la signature à fetchJson (réservé aux usages
// internes / tests futurs ; non exporté pour ne pas polluer l'API publique).
void fetchJson;
