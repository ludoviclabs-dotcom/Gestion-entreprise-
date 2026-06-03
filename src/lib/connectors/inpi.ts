import * as Sentry from "@sentry/nextjs";
import { env, hasInpiCreds, isDemoMode } from "@/lib/env";
import inpiFixture from "@/lib/fixtures/inpi-rne.sample.json";
import { transformRne } from "./inpi-transform";
import type { ConnectorResult } from "./types";

/**
 * Connecteur INPI / RNE (Registre National des Entreprises).
 *
 * Auth : POST {base}/sso/login {username,password} → { token } (JWT ~1h).
 * Données : GET {base}/companies/{siren} avec `Authorization: Bearer <token>`.
 * La réponse brute (très imbriquée) est aplatie par `transformRne` vers le
 * shape simplifié { siren, dirigeants, beneficiairesEffectifs } que consomme
 * `normalizeInpi`.
 *
 * Modes :
 *  - démo / pas de credentials → fixture (dirigeants déclarés DANONE).
 *  - live OK → données réelles (isFixture:false).
 *  - live en erreur → résultat VIDE (pas la fixture DANONE, qui serait fausse
 *    pour un autre SIREN) + capture Sentry. Ne lève jamais : `assembleCase`
 *    n'entoure pas les connecteurs de try/catch.
 */

function shouldMock(): boolean {
  return isDemoMode() || !hasInpiCreds();
}

// Cache module-level du token : évite un login à chaque dossier.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function login(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const res = await fetch(`${env.INPI_BASE_URL}/sso/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.INPI_USERNAME,
      password: env.INPI_PASSWORD,
    }),
  });
  if (!res.ok) {
    throw new Error(`INPI login failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("INPI login: token absent de la réponse");
  // Token RNE valable ~1h ; on le garde 50 min pour avoir de la marge.
  cachedToken = { value: data.token, expiresAt: Date.now() + 50 * 60_000 };
  return data.token;
}

export const inpi = {
  async getRne(siren: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: inpiFixture,
        endpoint: `fixture:inpi-rne:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const url = `${env.INPI_BASE_URL}/companies/${siren}`;
    try {
      const token = await login();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Erreur API : on ne renvoie PAS la fixture (données DANONE fausses pour
        // un autre SIREN). Résultat vide honnête + trace.
        Sentry.captureException(
          new Error(`INPI getRne ${siren}: HTTP ${res.status}`),
        );
        return {
          raw: { siren, dirigeants: [], beneficiairesEffectifs: [] },
          endpoint: `${url} (erreur ${res.status})`,
          httpStatus: res.status,
          isFixture: false,
        };
      }
      const rawRne = await res.json();
      const simplified = transformRne(rawRne, siren);
      return {
        raw: simplified,
        endpoint: url,
        httpStatus: res.status,
        isFixture: false,
      };
    } catch (error) {
      Sentry.captureException(error);
      return {
        raw: { siren, dirigeants: [], beneficiairesEffectifs: [] },
        endpoint: `${url} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};
