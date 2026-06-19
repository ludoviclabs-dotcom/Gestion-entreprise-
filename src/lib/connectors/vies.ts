import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isViesEnabled } from "@/lib/env";
import { fetchJson, RateLimiter } from "./http";
import viesFixture from "@/lib/fixtures/vies.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur VIES (VAT Information Exchange System, Commission européenne).
 *
 * Valide un numéro de TVA intracommunautaire. API REST publique, gratuite, sans
 * clé. On appelle VIES DIRECTEMENT (api-entreprise ne fait que l'encapsuler et
 * reste réservée aux administrations).
 *
 * ⚠️ VALIDATION uniquement (pas de détection de carrousel — couche
 * transactionnelle, hors de ce connecteur). Un `valid:false` n'est PAS un
 * signal de risque : la majorité des PME purement domestiques ne sont pas
 * enregistrées à la TVA intracommunautaire. On n'émet donc qu'un attribut
 * d'identité + un facteur ATTÉNUANT quand la TVA est active (corroboration).
 *
 * Modes (calqués sur les connecteurs opt-in) :
 *  - démo / flag absent → fixture.
 *  - live OK → données réelles ; SIREN non dérivable → `valid:null` honnête.
 *  - live en erreur → `valid:null` + capture Sentry. Ne lève jamais.
 */

export type ViesSimplified = {
  /** Forme complète « FR27552032534 », ou null si le SIREN n'est pas dérivable. */
  vatNumber: string | null;
  /** true/false selon VIES ; null = indéterminé (API indisponible / non dérivable). */
  valid: boolean | null;
  name: string | null;
};

const limiter = new RateLimiter(30, 60_000);

function shouldMock(): boolean {
  return isDemoMode() || !isViesEnabled();
}

/**
 * Dérive le n° de TVA intracommunautaire français d'un SIREN.
 * Clé = (12 + 3 × (SIREN mod 97)) mod 97, sur 2 chiffres. TVA = FR + clé + SIREN.
 * Renvoie null si le SIREN n'a pas exactement 9 chiffres.
 */
export function frVatFromSiren(
  siren: string,
): { countryCode: "FR"; number: string; full: string } | null {
  const digits = siren.replace(/\D/g, "");
  if (digits.length !== 9) return null;
  const key = (12 + 3 * (Number(digits) % 97)) % 97;
  const number = `${String(key).padStart(2, "0")}${digits}`;
  return { countryCode: "FR", number, full: `FR${number}` };
}

type ViesRaw = {
  valid?: boolean;
  isValid?: boolean;
  name?: string;
};

export const vies = {
  async validateFr(siren: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: viesFixture,
        endpoint: `fixture:vies:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const vat = frVatFromSiren(siren);
    if (!vat) {
      const raw: ViesSimplified = { vatNumber: null, valid: null, name: null };
      return {
        raw,
        endpoint: `vies:siren-non-derivable:${siren}`,
        httpStatus: 0,
        isFixture: false,
      };
    }
    const endpoint = `${env.VIES_BASE_URL}/ms/${vat.countryCode}/vat/${vat.number}`;
    try {
      const { data, status } = await fetchJson<ViesRaw>(endpoint, { limiter });
      // VIES a publié plusieurs noms de champ selon les versions (valid / isValid).
      const valid = data.valid ?? data.isValid ?? null;
      const raw: ViesSimplified = {
        vatNumber: vat.full,
        valid,
        name: data.name ?? null,
      };
      return { raw, endpoint, httpStatus: status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      const raw: ViesSimplified = { vatNumber: vat.full, valid: null, name: null };
      return {
        raw,
        endpoint: `${endpoint} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};
