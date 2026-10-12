/**
 * Catalogue PUBLIC des sources de KYB Graph : source unique de la page d'accueil,
 * de la page /sources et de la page Secteurs.
 *
 * Pur et sans accès à l'environnement : importable côté client comme serveur.
 * Il n'indique pas ce que la configuration d'un déploiement active (c'est le rôle
 * de `getConnectorStatuses()` et de la page Réglages) mais ce que le produit
 * revendique publiquement. Un test garantit qu'aucun connecteur n'est oublié.
 *
 * Règle éditoriale : une source n'est « actif » que si elle a été validée sur
 * des dossiers réels en production. Les objectifs restent affichés, mais
 * clairement marqués « en cours ».
 */

export type PublicSourceState = "actif" | "partiel" | "en_cours";

export type PublicFamilyId =
  | "identite"
  | "procedures"
  | "sanctions"
  | "commande-publique"
  | "environnement"
  | "groupes"
  | "presse";

export type PublicSource = {
  /** Clé du connecteur (identique à `getConnectorStatuses()`). */
  key: string;
  name: string;
  text: string;
  /** Mode d'accès, tel qu'il est vraiment pratiqué. */
  access: string;
  family: PublicFamilyId;
  state: PublicSourceState;
  /** Précision affichée sous l'état (limites, raison d'un « en cours »). */
  note?: string;
};

export const PUBLIC_FAMILIES: { id: PublicFamilyId; title: string; text: string }[] = [
  {
    id: "identite",
    title: "Identité et établissements",
    text: "Qui est l'entité, où elle est établie, qui la dirige.",
  },
  {
    id: "procedures",
    title: "Procédures et annonces légales",
    text: "Annonces officielles : procédures collectives, radiations, comptes déposés.",
  },
  {
    id: "sanctions",
    title: "Sanctions et gels des avoirs",
    text: "Entités et dirigeants rapprochés des listes de sanctions.",
  },
  {
    id: "commande-publique",
    title: "Commande publique et transparence",
    text: "Marchés publics attribués ou notifiés, représentants d'intérêts.",
  },
  {
    id: "environnement",
    title: "Environnement, sanitaire et labels",
    text: "Installations classées, titres miniers, agréments sanitaires, labels publics.",
  },
  {
    id: "groupes",
    title: "Groupes et sociétés mères à l'étranger",
    text: "Chaîne de contrôle repérée par identifiant légal, puis registre du pays.",
  },
  {
    id: "presse",
    title: "Presse",
    text: "Couverture médiatique mondiale, collectée après la création du dossier.",
  },
];

export const PUBLIC_SOURCES: PublicSource[] = [
  // ── Identité et établissements ──
  { key: "sirene", name: "INSEE Sirene", text: "Identité légale, établissements, activité", access: "API officielle", family: "identite", state: "actif" },
  { key: "recherche_entreprises", name: "Recherche d'entreprises (DINUM)", text: "Dirigeants publiés au RNE, comptes déposés, labels signalés", access: "API officielle", family: "identite", state: "actif" },
  { key: "ban", name: "Base Adresse Nationale", text: "Normalisation et géocodage des adresses", access: "API officielle", family: "identite", state: "actif" },
  { key: "vies", name: "VIES", text: "Validité du numéro de TVA intracommunautaire", access: "Service de la Commission européenne", family: "identite", state: "actif" },
  { key: "annuaire_administration", name: "Annuaire de l'administration", text: "Services publics des collectivités et administrations", access: "API officielle", family: "identite", state: "actif" },
  {
    key: "inpi",
    name: "INPI / RNE",
    text: "Bénéficiaires effectifs, accès conditionné à un intérêt légitime",
    access: "Sur habilitation",
    family: "identite",
    state: "en_cours",
    note: "Accès à obtenir : l'arrêt CJUE de 2022 le conditionne à un intérêt légitime.",
  },
  {
    key: "pappers",
    name: "Pappers",
    text: "Comptes annuels détaillés",
    access: "Service tiers sous abonnement",
    family: "identite",
    state: "en_cours",
    note: "Raccordement prêt ; abonnement à renouveler.",
  },

  // ── Procédures et annonces légales ──
  { key: "bodacc", name: "BODACC", text: "Annonces légales, procédures collectives, radiations", access: "API publique", family: "procedures", state: "actif" },
  { key: "balo", name: "BALO", text: "Annonces financières des sociétés cotées", access: "API publique", family: "procedures", state: "actif" },
  { key: "joafe", name: "JOAFE", text: "Journal officiel des associations et fondations", access: "API publique", family: "procedures", state: "actif" },
  { key: "dca", name: "Comptes des associations (DCA)", text: "Comptes déposés par les associations", access: "API publique", family: "procedures", state: "actif" },

  // ── Sanctions et gels des avoirs ──
  { key: "tresor", name: "DG Trésor", text: "Registre national des gels des avoirs", access: "Jeu ouvert importé", family: "sanctions", state: "actif" },
  {
    key: "sanctions_intl",
    name: "Listes de sanctions internationales",
    text: "États-Unis (CSL), Royaume-Uni, ONU, Suisse (SECO) et Canada : organisations et dirigeants, rapprochés par nom et année de naissance",
    access: "Jeux ouverts importés",
    family: "sanctions",
    state: "actif",
  },
  {
    key: "opensanctions",
    name: "OpenSanctions",
    text: "Agrégat de listes de sanctions et personnes politiquement exposées",
    access: "Service tiers",
    family: "sanctions",
    state: "en_cours",
    note: "Contrôle des personnes politiquement exposées : objectif en cours de mise en service.",
  },

  // ── Commande publique et transparence ──
  { key: "boamp", name: "BOAMP", text: "Avis de marchés publics mentionnant l'entreprise", access: "API publique", family: "commande-publique", state: "actif" },
  { key: "decp", name: "Marchés publics (DECP)", text: "Marchés attribués : titulaire et acheteur, sur douze mois", access: "Jeu ouvert importé", family: "commande-publique", state: "actif" },
  { key: "hatvp", name: "Répertoire HATVP", text: "Représentants d'intérêts déclarés (organisations)", access: "Jeu ouvert importé", family: "commande-publique", state: "actif" },

  // ── Environnement, sanitaire et labels ──
  { key: "georisques", name: "Géorisques", text: "Installations classées (ICPE) par établissement", access: "Jeu importé et API", family: "environnement", state: "actif" },
  { key: "camino", name: "Titres miniers (Camino)", text: "Titres et échéances déclarées", access: "Jeu ouvert importé", family: "environnement", state: "actif" },
  { key: "dgal", name: "Agréments sanitaires CE (DGAL)", text: "Établissements agréés, 18 listes officielles", access: "Jeu ouvert importé", family: "environnement", state: "actif" },
  { key: "alim_confiance", name: "Alim'confiance", text: "Résultats des contrôles sanitaires publiés", access: "API publique", family: "environnement", state: "actif" },
  { key: "rge", name: "RGE (ADEME)", text: "Qualification des entreprises de rénovation énergétique", access: "API publique", family: "environnement", state: "actif" },
  { key: "agence_bio", name: "Agence BIO", text: "Opérateurs de l'agriculture biologique", access: "API publique", family: "environnement", state: "actif" },
  { key: "qualiopi", name: "Organismes de formation (DGEFP)", text: "Déclaration d'activité et certification Qualiopi", access: "API publique", family: "environnement", state: "actif" },

  // ── Groupes et sociétés mères à l'étranger ──
  { key: "gleif", name: "GLEIF", text: "Identifiant légal (LEI) et chaîne de sociétés mères", access: "API publique", family: "groupes", state: "actif" },
  { key: "companies_house", name: "Companies House (Royaume-Uni)", text: "Dirigeants et contrôle des sociétés mères britanniques", access: "API officielle", family: "groupes", state: "actif" },
  { key: "brreg", name: "Registre norvégien (Brønnøysund)", text: "Statut, forme et comptes des sociétés mères norvégiennes", access: "API officielle", family: "groupes", state: "actif" },
  { key: "acra", name: "Registre de Singapour (ACRA)", text: "Statut et type des sociétés mères singapouriennes", access: "Jeu ouvert (data.gov.sg)", family: "groupes", state: "actif" },

  // ── Presse ──
  {
    key: "gdelt",
    name: "GDELT",
    text: "Couverture médiatique mondiale, défavorable ou non",
    access: "Service tiers ouvert",
    family: "presse",
    state: "partiel",
    note: "Le service limite fortement les requêtes : une collecte peut échouer et se relancer à la demande.",
  },
];

/** Connecteurs de la table des statuts qui ne sont pas des sources de données. */
export const NON_PUBLIC_CONNECTOR_KEYS: readonly string[] = ["database"];

export const SOURCE_STATE_LABEL: Record<PublicSourceState, string> = {
  actif: "Actif",
  partiel: "Disponibilité partielle",
  en_cours: "En cours",
};

export function sourcesOfFamily(id: PublicFamilyId): PublicSource[] {
  return PUBLIC_SOURCES.filter((s) => s.family === id);
}

export type PublicSourceCounts = {
  total: number;
  /** Actives, y compris à disponibilité partielle. */
  active: number;
  partial: number;
  inProgress: number;
};

export function publicSourceCounts(sources: readonly PublicSource[] = PUBLIC_SOURCES): PublicSourceCounts {
  const partial = sources.filter((s) => s.state === "partiel").length;
  const inProgress = sources.filter((s) => s.state === "en_cours").length;
  return {
    total: sources.length,
    active: sources.length - inProgress,
    partial,
    inProgress,
  };
}

/** Une ligne par famille, pour la page d'accueil. */
export function familySummaries(
  sources: readonly PublicSource[] = PUBLIC_SOURCES,
): {
  id: PublicFamilyId;
  title: string;
  names: string;
  active: number;
  partial: number;
  inProgress: number;
}[] {
  return PUBLIC_FAMILIES.map((f) => {
    const own = sources.filter((s) => s.family === f.id);
    const live = own.filter((s) => s.state !== "en_cours");
    return {
      id: f.id,
      title: f.title,
      names: live.map((s) => s.name).join(", "),
      active: live.length,
      partial: live.filter((s) => s.state === "partiel").length,
      inProgress: own.length - live.length,
    };
  });
}

/** Chapeau de la section « Sources » de l'accueil, calculé à partir du catalogue. */
export function sourcesIntro(counts: PublicSourceCounts = publicSourceCounts()): string {
  const progress =
    counts.inProgress > 0
      ? `, ${counts.inProgress} en cours de mise en service`
      : "";
  return (
    `${counts.active} sources publiques actives${progress}. ` +
    "Interrogées par API ou importées depuis les jeux ouverts de l'administration, jamais de scraping. " +
    "Chaque réponse brute est conservée dans la chaîne de preuve."
  );
}
