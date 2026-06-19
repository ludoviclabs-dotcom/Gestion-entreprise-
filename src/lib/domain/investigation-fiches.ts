import { type RegKey } from "@/lib/domain/regulatory-refs";

/**
 * Fiches d'investigation (M11) — par règle/typologie, les PIÈCES à vérifier et
 * les INCOHÉRENCES à lever (formulées en QUESTIONS, jamais en conclusions).
 *
 * Indexées par `ruleId` (les ids de `DEFAULT_RULES`). Catalogue EN CODE (B2) ;
 * l'exhaustivité est garantie par un TEST (chaque ruleId a une fiche), pas par le
 * type. Aucun vocabulaire accusatoire (garde-fou + test).
 */
export type InvestigationFiche = {
  /** Pièces à demander / consulter. */
  documents: readonly string[];
  /** Écarts à lever, formulés en questions de vérification. */
  incoherences: readonly string[];
  /** Ancrages réglementaires (clés de REG). */
  refs: readonly RegKey[];
};

export const INVESTIGATION_FICHES = {
  DIRIGEANT_MULTI_SOCIETES: {
    documents: [
      "Extraits Kbis des sociétés dirigées",
      "Liste des mandats au RNE",
      "Pièce d'identité du dirigeant",
    ],
    incoherences: [
      "Le dirigeant a-t-il les moyens d'exercer effectivement chaque mandat ?",
      "Les sociétés partagent-elles adresse, comptable ou activité ?",
    ],
    refs: ["CMF_L561_5", "FATF_R24"],
  },
  ADRESSE_PARTAGEE: {
    documents: [
      "Contrat de domiciliation ou bail",
      "Justificatifs d'activité de chaque société à l'adresse",
    ],
    incoherences: [
      "L'adresse est-elle un centre de domiciliation déclaré ?",
      "Chaque société y exerce-t-elle une activité réelle ?",
    ],
    refs: ["CMF_L561_5"],
  },
  SOCIETE_RECENTE_TRES_LIEE: {
    documents: [
      "Statuts et attestation d'immatriculation",
      "Premiers comptes annuels si disponibles",
      "Origine du capital initial",
    ],
    incoherences: [
      "Le volume de liens est-il cohérent avec l'ancienneté de la société ?",
      "D'où proviennent les apports au capital ?",
    ],
    refs: ["CMF_L561_5"],
  },
  PROCEDURE_COLLECTIVE: {
    documents: [
      "Jugement d'ouverture et annonce BODACC",
      "État des créances et inventaire d'actifs",
    ],
    incoherences: [
      "Des cessions d'actifs ont-elles précédé la procédure ?",
      "Les dirigeants ont-ils constitué des entités similaires en amont ?",
    ],
    refs: ["CMF_L561_5"],
  },
  RADIATION: {
    documents: ["Annonce BODACC de radiation", "Dernier extrait Kbis"],
    incoherences: [
      "La radiation suit-elle un transfert d'activité ?",
      "Les engagements en cours ont-ils été repris par une autre entité ?",
    ],
    refs: ["CMF_L561_5"],
  },
  CYCLE_DETENTION: {
    documents: [
      "Organigramme capitalistique complet",
      "Registre des bénéficiaires effectifs (RBE)",
      "Pactes d'associés",
    ],
    incoherences: [
      "Qui exerce le contrôle in fine de la boucle ?",
      "La circularité a-t-elle une justification économique documentée ?",
    ],
    refs: ["AMLR", "FATF_R24"],
  },
  PIVOT_SUSPECT: {
    documents: [
      "Organigramme et mandats du nœud central",
      "Conventions intra-groupe",
    ],
    incoherences: [
      "Le nœud central dispose-t-il d'une substance propre (effectif, activité) ?",
      "Son rôle d'intermédiation est-il économiquement justifié ?",
    ],
    refs: ["FATF_R24"],
  },
  ECART_UBO_DECLARE: {
    documents: [
      "Extrait du registre des bénéficiaires effectifs (RBE/INPI)",
      "Chaîne de détention complète",
      "Pactes et conventions de vote",
    ],
    incoherences: [
      "L'écart provient-il d'un registre non mis à jour ?",
      "Existe-t-il un contrôle par d'autres moyens (droits de vote, pacte) ?",
    ],
    refs: ["AMLR", "CMF_L561_46", "CJUE_UBO"],
  },
  PROXIMITE_SANCTION: {
    documents: [
      "Pièce d'identité (date de naissance, nationalité)",
      "Références de la mesure (UE/ONU) et nature du lien",
    ],
    incoherences: [
      "S'agit-il d'une homonymie ? (vérifier les identifiants, pas seulement le nom)",
      "Le lien est-il direct, capitalistique, ou seulement de domiciliation ?",
    ],
    refs: ["CMF_L561_5", "AMLR"],
  },
  RESOLUTION_SANCTION: {
    documents: [
      "Pièce d'identité (date de naissance, nationalité)",
      "Références de la mesure signalée (UE/ONU) et identifiants officiels",
    ],
    incoherences: [
      "S'agit-il d'une homonymie ? (comparer date de naissance et identifiants officiels, pas seulement le nom)",
      "Le rapprochement nominatif est-il corroboré par un autre élément (adresse, mandat, nationalité) ?",
    ],
    refs: ["CMF_L561_5", "AMLR"],
  },
  RELAIS_STRUCTUREL: {
    documents: [
      "Comptes annuels et effectif",
      "Bail / justificatifs de locaux",
      "Conventions de prestation entrantes et sortantes",
    ],
    incoherences: [
      "La société dispose-t-elle d'une substance réelle (locaux, salariés) ?",
      "Les liens entrants et sortants correspondent-ils à une activité avérée ?",
    ],
    refs: ["FATF_R24", "CMF_L561_5"],
  },
  CONCENTRATION_DOMICILIATION: {
    documents: [
      "Contrat de domiciliation et agrément du domiciliataire",
      "Liste des sociétés domiciliées et leurs justificatifs d'activité",
    ],
    incoherences: [
      "Le domiciliataire est-il agréé ?",
      "Les sociétés récentes y ont-elles une activité distincte et réelle ?",
    ],
    refs: ["CMF_L561_5"],
  },
  CHAINE_DETENTION_OPAQUE: {
    documents: [
      "Statuts et répartition du capital",
      "Registre des mouvements de titres",
      "Registre des bénéficiaires effectifs (RBE)",
    ],
    incoherences: [
      "Pourquoi les pourcentages de détention sont-ils indisponibles ?",
      "La chaîne complète de détention peut-elle être documentée ?",
    ],
    refs: ["AMLR", "CMF_L561_46"],
  },
} as const satisfies Record<string, InvestigationFiche>;

export type InvestigationFicheId = keyof typeof INVESTIGATION_FICHES;
