import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isBanEnabled } from "@/lib/env";
import { fetchJson, RateLimiter } from "./http";
import banFixture from "@/lib/fixtures/ban.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur Base Adresse Nationale (BAN) — géocodage / normalisation d'adresse.
 *
 * API publique gratuite, sans clé. Sert à **canoniser** l'adresse du siège
 * (libellé stable + identifiant BAN + coordonnées), pour que deux sociétés à la
 * même adresse physique partagent le MÊME nœud `Adresse` — condition pour que le
 * clustering de domiciliation (`ADRESSE_PARTAGEE`, `CONCENTRATION_DOMICILIATION`)
 * soit fiable. Sans normalisation, « 17 BD HAUSSMANN » et « 17 boulevard
 * Haussmann » produisent deux nœuds distincts et la domiciliation partagée
 * reste invisible.
 *
 * Modes (calqués sur les connecteurs opt-in) :
 *  - démo / flag absent → fixture.
 *  - live OK → données réelles.
 *  - live en erreur / requête vide → FeatureCollection vide (repli slug Sirene).
 */

export type BanAddress = {
  /** Identifiant BAN stable (properties.id) — clé de nœud adresse canonique. */
  id: string;
  /** Libellé canonique (properties.label). */
  label: string;
  postcode: string | null;
  city: string | null;
  citycode: string | null;
  lat: number | null;
  lon: number | null;
  /** Score de confiance 0..1 (properties.score). */
  score: number;
};

type BanFeature = {
  geometry?: { coordinates?: [number, number] } | null;
  properties?: {
    id?: string;
    label?: string;
    postcode?: string;
    city?: string;
    citycode?: string;
    score?: number;
  } | null;
};
type BanResponse = { features?: BanFeature[] };

const limiter = new RateLimiter(45, 60_000);

function shouldMock(): boolean {
  return isDemoMode() || !isBanEnabled();
}

export const ban = {
  async geocode(query: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: banFixture,
        endpoint: "fixture:ban",
        httpStatus: 0,
        isFixture: true,
      };
    }
    const q = query.trim();
    if (!q) {
      return {
        raw: { features: [] },
        endpoint: "ban:requete-vide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const endpoint = `${env.BAN_BASE_URL}/search/?q=${encodeURIComponent(q)}&limit=1`;
    try {
      const { data, status } = await fetchJson<BanResponse>(endpoint, { limiter });
      return { raw: data, endpoint, httpStatus: status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return {
        raw: { features: [] },
        endpoint: `${endpoint} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};

/** Extrait la meilleure adresse BAN d'une réponse, ou null. Pur, ne lève jamais. */
export function banAddressFrom(raw: unknown): BanAddress | null {
  const feat = (raw as BanResponse)?.features?.[0];
  const p = feat?.properties;
  if (!p?.id) return null;
  const coords = feat?.geometry?.coordinates;
  const lon = Array.isArray(coords) && typeof coords[0] === "number" ? coords[0] : null;
  const lat = Array.isArray(coords) && typeof coords[1] === "number" ? coords[1] : null;
  return {
    id: p.id,
    label: p.label ?? "",
    postcode: p.postcode ?? null,
    city: p.city ?? null,
    citycode: p.citycode ?? null,
    lat,
    lon,
    score: typeof p.score === "number" ? p.score : 0,
  };
}
