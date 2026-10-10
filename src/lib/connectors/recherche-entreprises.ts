import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isRechercheEntreprisesEnabled } from "@/lib/env";
import { RateLimiter } from "./http";
import fixture from "@/lib/fixtures/recherche-entreprises.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur « Recherche d'entreprises » (DINUM, annuaire-entreprises.data.gouv.fr).
 *
 * API ouverte, gratuite, SANS clé ni compte. Pour un SIREN elle agrège :
 *  - les dirigeants publiés au RNE (personnes physiques et morales) ;
 *  - les derniers comptes publiés (chiffre d'affaires, résultat net) ;
 *  - des indicateurs publics (bio, RGE, Qualiopi, Alim'confiance, ESS…) ;
 *  - la date de dernière mise à jour du RNE (fraîcheur des dirigeants).
 *
 * Limite documentée : 7 requêtes / s / IP, sans débit garanti. Un HTTP 429 est
 * retenté UNE fois (Retry-After plafonné), puis traité comme indisponibilité.
 *
 * Minimisation : ni date de naissance, ni nationalité, ni adresse personnelle.
 *
 * Modes (calqués sur les connecteurs opt-in) :
 *  - démo / flag absent → fixture synthétique ;
 *  - live OK → données réelles ;
 *  - SIREN absent des résultats → `not_found` (absence ≠ panne) ;
 *  - live en échec (429 persistant, 5xx, schéma inattendu, exception) → résultat
 *    vide dégradé (endpoint suffixé) + Sentry. Ne lève jamais.
 */

export type ReDirigeant = {
  /** « personne physique » | « personne morale » (valeur brute du registre). */
  type: string;
  nom: string | null;
  prenoms: string | null;
  qualite: string | null;
  /** Personne morale dirigeante : son SIREN et sa dénomination. */
  siren: string | null;
  denomination: string | null;
};

export type ReFinance = {
  annee: number;
  ca: number | null;
  resultatNet: number | null;
};

export type RechercheEntreprisesRaw = {
  status: "ok" | "not_found" | "indisponible";
  company: {
    siren: string;
    name: string | null;
    administrativeState: string | null;
    legalCategory: string | null;
    createdOn: string | null;
    /** Dernière mise à jour du RNE : borne la fraîcheur des dirigeants. */
    rneUpdatedOn: string | null;
    /** Établissements ouverts (borne la couverture des sources par SIRET). */
    openEstablishments?: number | null;
  } | null;
  dirigeants: ReDirigeant[];
  /** Triés par année décroissante. */
  finances: ReFinance[];
  /** Indicateurs publics vrais (libellés français). */
  labels: string[];
  tva: string[];
  /** Numéro RNA (associations : `complements.identifiant_association`). */
  rna?: string | null;
};

const limiter = new RateLimiter(6, 1_000);
const TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_MS = 3_000;

function shouldMock(): boolean {
  return isDemoMode() || !isRechercheEntreprisesEnabled();
}

/**
 * Libellés des indicateurs qui déclenchent les connecteurs de détail du lot B
 * (RGE, Agence BIO, Alim'confiance, Qualiopi) : ils ne sont interrogés que si
 * Recherche d'entreprises signale le label.
 */
export const LABEL_BIO = "Agriculture biologique";
export const LABEL_RGE = "RGE";
export const LABEL_QUALIOPI = "Qualiopi";
/**
 * Organisme de formation DÉCLARÉ (indicateur distinct de Qualiopi) : un organisme
 * non certifié porte ce seul indicateur, mais figure bien dans la liste publique
 * DGEFP avec son numéro de déclaration d'activité.
 */
export const LABEL_ORGANISME_FORMATION = "Organisme de formation";
export const LABEL_ALIM_CONFIANCE = "Alim'confiance";

/** Indicateurs `complements.est_*` retenus → libellé français. */
const LABELS: [string, string][] = [
  ["est_bio", LABEL_BIO],
  ["est_rge", LABEL_RGE],
  ["est_qualiopi", LABEL_QUALIOPI],
  ["est_organisme_formation", LABEL_ORGANISME_FORMATION],
  ["est_alim_confiance", LABEL_ALIM_CONFIANCE],
  ["est_ess", "ESS"],
  ["est_association", "Association"],
  ["est_societe_mission", "Société à mission"],
  ["est_entrepreneur_spectacle", "Entrepreneur de spectacles"],
  ["est_patrimoine_vivant", "Entreprise du patrimoine vivant"],
  ["est_siae", "SIAE"],
  ["est_finess", "Établissement sanitaire (FINESS)"],
  ["est_uai", "Établissement scolaire (UAI)"],
];

type Json = Record<string, unknown>;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

const empty = (status: RechercheEntreprisesRaw["status"]): RechercheEntreprisesRaw => ({
  status,
  company: null,
  dirigeants: [],
  finances: [],
  labels: [],
  tva: [],
});

/** Réduit un résultat de l'API à la forme minimale conservée. Pur, défensif. */
export function simplifyResult(r: Json): RechercheEntreprisesRaw {
  const dirigeants = (Array.isArray(r.dirigeants) ? r.dirigeants : [])
    .filter(isObj)
    .map<ReDirigeant>((d) => ({
      type: str(d.type_dirigeant) ?? "inconnu",
      nom: str(d.nom),
      prenoms: str(d.prenoms),
      qualite: str(d.qualite),
      siren: str(d.siren),
      denomination: str(d.denomination),
    }));

  const finances: ReFinance[] = isObj(r.finances)
    ? Object.entries(r.finances)
        .map(([year, v]) => ({
          annee: Number(year),
          ca: isObj(v) ? num(v.ca) : null,
          resultatNet: isObj(v) ? num(v.resultat_net) : null,
        }))
        .filter((f) => Number.isInteger(f.annee) && (f.ca != null || f.resultatNet != null))
        .sort((a, b) => b.annee - a.annee)
    : [];

  const complements = isObj(r.complements) ? r.complements : {};
  const labels = LABELS.filter(([key]) => complements[key] === true).map(([, fr]) => fr);

  return {
    status: "ok",
    company: {
      siren: str(r.siren) ?? "",
      name: str(r.nom_complet) ?? str(r.nom_raison_sociale),
      administrativeState: str(r.etat_administratif),
      legalCategory: str(r.nature_juridique),
      createdOn: str(r.date_creation),
      rneUpdatedOn: str(r.date_mise_a_jour_rne),
      openEstablishments:
        typeof r.nombre_etablissements_ouverts === "number"
          ? r.nombre_etablissements_ouverts
          : null,
    },
    dirigeants,
    finances,
    labels,
    tva: Array.isArray(r.tva) ? r.tva.filter((t): t is string => typeof t === "string") : [],
    rna: str(complements.identifiant_association),
  };
}

export const rechercheEntreprises = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: fixture,
        endpoint: `fixture:recherche-entreprises:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const endpoint = `${env.RECHERCHE_ENTREPRISES_BASE_URL}/search?q=${encodeURIComponent(
      siren,
    )}&page=1&per_page=5`;
    const degraded = (httpStatus: number, suffix: string): ConnectorResult<unknown> => ({
      raw: empty("indisponible"),
      endpoint: `${endpoint} ${suffix}`,
      httpStatus,
      isFixture: false,
    });

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await limiter.wait();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let res: Response;
        let text: string;
        try {
          res = await fetch(endpoint, {
            headers: { Accept: "application/json", "User-Agent": "KYB-Graph/1.0" },
            signal: controller.signal,
          });
          text = await res.text();
        } finally {
          clearTimeout(timer);
        }

        if (res.status === 429 && attempt === 0) {
          const wait = Number(res.headers.get("retry-after")) * 1000;
          await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(wait) && wait > 0 ? wait : 1_000, MAX_RETRY_AFTER_MS)));
          continue;
        }
        if (res.status < 200 || res.status >= 300) {
          Sentry.captureMessage(`Recherche d'entreprises: HTTP ${res.status}`, "warning");
          return degraded(res.status, `(erreur ${res.status})`);
        }

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          Sentry.captureMessage("Recherche d'entreprises: réponse non JSON", "warning");
          return degraded(res.status, "(schéma non reconnu)");
        }
        if (!isObj(json) || !Array.isArray(json.results)) {
          Sentry.captureMessage("Recherche d'entreprises: schéma inattendu", "warning");
          return degraded(res.status, "(schéma non reconnu)");
        }

        // Correspondance EXACTE sur le SIREN (le champ q est une recherche plein texte).
        const hit = json.results.filter(isObj).find((r) => str(r.siren) === siren);
        if (!hit) {
          // La requête a réussi (HTTP 2xx) mais ce SIREN n'est pas publié (ex.
          // non diffusible) : absence avérée, pas une panne → statut HTTP réel.
          return { raw: empty("not_found"), endpoint, httpStatus: res.status, isFixture: false };
        }
        return { raw: simplifyResult(hit), endpoint, httpStatus: res.status, isFixture: false };
      }
      return degraded(429, "(erreur 429)");
    } catch (error) {
      Sentry.captureException(error);
      return degraded(0, "(exception)");
    }
  },
};
