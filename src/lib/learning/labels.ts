import type { ActorKind, ClaimNature, ResourceKind, SourceKind, Verification } from "./schema";

/** Libellés d'affichage des statuts d'affirmation (cadrage §3.2). */
export const CLAIM_NATURE_LABELS: Record<ClaimNature, { label: string; hint: string; example: string }> = {
  fait_documente: {
    label: "Fait documenté",
    hint: "Une pièce établit une proposition précise.",
    example: "Le contrat prévoit une licence limitée au marché européen.",
  },
  allegation: {
    label: "Allégation",
    hint: "Quelqu'un l'affirme ; ce n'est pas encore établi.",
    example: "Un salarié signale que le prestataire consulte des plans hors périmètre.",
  },
  hypothese: {
    label: "Hypothèse",
    hint: "Explication possible, à confronter à d'autres.",
    example: "L'accès a peut-être été prolongé par un avenant.",
  },
  information_manquante: {
    label: "Information manquante",
    hint: "Ce qu'il faudrait savoir et qu'on ne sait pas.",
    example: "Le titulaire du compte destinataire n'est pas documenté.",
  },
};

export const VERIFICATION_LABELS: Record<Verification, string> = {
  non_verifie: "Non vérifié",
  declare: "Déclaré",
  recoupe: "Recoupé",
  valide: "Validé dans le périmètre",
};

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  texte_officiel: "Texte officiel",
  publication_autorite: "Publication d'autorité",
  guide: "Guide officiel",
  documentation_technique: "Documentation technique",
  etude: "Étude (source secondaire)",
  presse: "Presse (source secondaire)",
  piece_fictive: "Pièce fictive",
};

export const ACTOR_KIND_LABELS: Record<ActorKind, string> = {
  entreprise: "Entreprise",
  personne: "Personne physique",
  investisseur: "Investisseur",
  prestataire_crypto: "Prestataire sur cryptoactifs",
  banque: "Banque",
  prestataire_technique: "Prestataire technique",
  client: "Client",
  preteur: "Prêteur",
  autorite: "Autorité",
};

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  compte_bancaire: "Compte bancaire",
  compte_prestataire: "Compte chez un prestataire",
  adresse: "Adresse",
  contrat_intelligent: "Contrat intelligent",
  brevet: "Brevet",
  logiciel: "Logiciel",
  donnees: "Données",
  procede: "Procédé",
  systeme: "Système d'information",
  contrat: "Contrat",
};
