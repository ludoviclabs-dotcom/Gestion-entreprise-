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

/**
 * Dirigeant / représentant d'une réponse Pappers. Tous les champs sont optionnels :
 * l'API v2 publie la liste sous `representants` (personnes physiques ET morales,
 * `personne_morale: true`) alors que la fixture historique l'appelle `dirigeants`.
 * Les deux sont lus (cf. `pappersDirigeants`).
 */
export type PappersPerson = {
  nom?: string | null;
  prenom?: string | null;
  nom_complet?: string | null;
  denomination?: string | null;
  siren?: string | null;
  qualite?: string | null;
  personne_morale?: boolean | null;
  date_de_naissance_formate?: string | null;
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
  dirigeants?: PappersPerson[];
  representants?: PappersPerson[];
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
    const empty = {
      siren,
      nom_entreprise: null,
      dirigeants: [],
      representants: [],
      beneficiaires_effectifs: [],
      finances: [],
    };
    try {
      const { data, status } = await fetchJson<PappersResult>(url, { limiter });
      // Réponse en erreur (clé refusée 401, quota 403/429, SIREN inconnu 404) :
      // le corps est un JSON d'erreur, jamais une donnée. On le remplace par un
      // résultat vide et on conserve le statut HTTP pour la santé de la source.
      if (status < 200 || status >= 300) {
        Sentry.captureMessage(`Pappers: HTTP ${status}`, "warning");
        return {
          raw: empty,
          endpoint: `${endpoint} (erreur ${status})`,
          httpStatus: status,
          isFixture: false,
        };
      }
      return { raw: data, endpoint, httpStatus: status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return {
        raw: empty,
        endpoint: `${endpoint} (exception)`,
        httpStatus: 0,
        isFixture: false,
      };
    }
  },
};
