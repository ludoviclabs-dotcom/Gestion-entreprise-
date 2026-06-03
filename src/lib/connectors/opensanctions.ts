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
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${env.OPENSANCTIONS_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return {
      raw: data,
      endpoint: url,
      httpStatus: res.status,
      isFixture: false,
    };
  },
};

// Helper interne pour conformer la signature à fetchJson (réservé aux usages
// internes / tests futurs ; non exporté pour ne pas polluer l'API publique).
void fetchJson;
