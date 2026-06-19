import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isPappersEnabled } from "@/lib/env";
import { fetchJson, RateLimiter } from "./http";
import pappersFixture from "@/lib/fixtures/pappers.sample.json";
import type { ConnectorResult } from "./types";

export type PappersFinance = {
  annee: number;
  chiffre_affaires: number | null;
  resultat_net: number | null;
  capitaux_propres: number | null;
  effectif: number | null;
};

export type PappersResult = {
  siren: string;
  nom_entreprise: string | null;
  forme_juridique: string | null;
  date_creation: string | null;
  capital: number | null;
  statut_rcs: string | null;
  siege: {
    adresse_ligne_1?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  dirigeants: {
    nom: string | null;
    prenom: string | null;
    qualite: string | null;
    date_de_naissance_formate: string | null;
  }[];
  beneficiaires_effectifs: {
    nom: string | null;
    prenom: string | null;
    pourcentage_parts: number | null;
    date_de_naissance_formate: string | null;
  }[];
  finances: PappersFinance[];
};

const limiter = new RateLimiter(30, 60_000);

function shouldMock(): boolean {
  return isDemoMode() || !isPappersEnabled();
}

export const pappers = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: pappersFixture,
        endpoint: `fixture:pappers:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    // Le token d'API ne doit JAMAIS être persisté : `endpoint` est enregistré
    // dans source_records + le journal de preuve, et affiché par l'inspecteur de
    // provenance / les rapports. On passe donc `api_token` en query pour l'appel
    // réel (méthode d'auth Pappers), mais on enregistre un endpoint SANS le token.
    const endpoint =
      `${env.PAPPERS_BASE_URL}/entreprise` +
      `?siren=${encodeURIComponent(siren)}` +
      `&extrait_kbis=0&publications_bodacc=0`;
    const url = `${endpoint}&api_token=${env.PAPPERS_API_KEY}`;
    try {
      const { data, status } = await fetchJson<PappersResult>(url, { limiter });
      return { raw: data, endpoint, httpStatus: status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return {
        raw: {
          siren,
          nom_entreprise: null,
          dirigeants: [],
          beneficiaires_effectifs: [],
          finances: [],
        },
        endpoint: `${endpoint} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};
