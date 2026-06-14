import {
  env,
  hasOpenSanctionsKey,
  isDemoMode,
  isOpenSanctionsSelfHosted,
} from "@/lib/env";
import fixture from "@/lib/fixtures/opensanctions.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur OpenSanctions — base ouverte EU agrégeant des centaines de
 * listes sanctions (UE, OFAC, ONU, gels nationaux) + listes PEP.
 *
 * Mode mock : en démo, OU sans clé ET sans instance auto-hébergée (yente).
 * Une instance yente self-hosted peut tourner sans jeton (cf.
 * docs/screening-yente.md) → on l'interroge dès que OPENSANCTIONS_SELF_HOSTED=true.
 *
 * API publique / yente : POST `/match/{dataset}`, même contrat.
 *
 * ⚠️ Ne lève JAMAIS : assembleCase n'entoure pas les connecteurs de try/catch.
 * Sur erreur réseau / HTTP non-OK / corps non-JSON → résultat vide non-fixture.
 */
export type OpenSanctionsQueryInput = {
  schema: "Person" | "Company" | "Organization";
  name: string;
  // Identifiants alternatifs : SIREN/SIRET côté société, dob côté personne.
  identifier?: string;
  birthDate?: string;
};

function shouldMock(): boolean {
  return (
    isDemoMode() || (!hasOpenSanctionsKey() && !isOpenSanctionsSelfHosted())
  );
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
              ...(q.identifier ? { registrationNumber: [q.identifier] } : {}),
              ...(q.birthDate ? { birthDate: [q.birthDate] } : {}),
            },
          },
        ]),
      ),
    };
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // En-tête d'auth uniquement si une clé est posée (yente peut être sans jeton ;
    // évite « Authorization: Bearer undefined »).
    if (env.OPENSANCTIONS_API_KEY) {
      headers["Authorization"] = `${env.OPENSANCTIONS_AUTH_SCHEME} ${env.OPENSANCTIONS_API_KEY}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { raw: {}, endpoint: url, httpStatus: res.status, isFixture: false };
      }
      const data = await res.json();
      return { raw: data, endpoint: url, httpStatus: res.status, isFixture: false };
    } catch {
      // Réseau / timeout / JSON invalide → vide, sans casser l'assemblage.
      return { raw: {}, endpoint: url, httpStatus: 0, isFixture: false };
    } finally {
      clearTimeout(timer);
    }
  },
};
