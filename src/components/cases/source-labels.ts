import type { SourceKind } from "@/lib/graph/source";

/** Libellés FR des sources (partagés onglet Sources / inspecteur de preuve). */
export const SOURCE_LABELS: Record<SourceKind, string> = {
  sirene: "INSEE Sirene",
  bodacc: "BODACC",
  inpi: "INPI / RNE",
  tresor_gels: "DG Tresor - gels",
  opensanctions: "OpenSanctions",
  gleif: "GLEIF / LEI",
  vies: "VIES (TVA UE)",
  ban: "Base Adresse Nationale",
  gdelt: "Presse (GDELT)",
  pappers: "Pappers",
  companies_house: "Companies House (UK)",
  brreg: "Registre norvégien (Brønnøysund)",
  acra: "Registre de Singapour (ACRA)",
  recherche_entreprises: "Recherche d'entreprises (DINUM)",
  balo: "BALO (annonces financières)",
  boamp: "BOAMP (marchés publics)",
  joafe: "JOAFE (associations)",
  dca: "Comptes des associations (DCA)",
  rge: "RGE (ADEME)",
  agence_bio: "Agence BIO",
  alim_confiance: "Alim'confiance (DGAL)",
  qualiopi: "Organismes de formation (DGEFP)",
  georisques: "Géorisques (installations classées)",
  annuaire_administration: "Annuaire de l'administration",
  camino: "Titres miniers (Camino)",
  hatvp: "Répertoire HATVP",
  decp: "Données essentielles de la commande publique (DECP)",
  sanctions_intl: "Listes de sanctions internationales",
  manual: "Manuel",
  fixture: "Fixture",
};

export const SUBJECT_LABELS = {
  entity: "Entite",
  edge: "Lien",
  event: "Evenement",
  risk_signal: "Signal",
} as const;
