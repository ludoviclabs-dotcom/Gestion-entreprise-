/**
 * Contenu de la page /securite (trust center) — où vivent les données,
 * sous-traitants RGPD art. 28, et trajectoire de certification.
 *
 * Spécifique KYB Graph (aucun appel LLM en production) — dérivé de
 * docs/sovereignty.md et docs/regulatory.md. Aucun import cross-repo.
 */

export type HostingLayer = {
  layer: string;
  provider: string;
  region: string;
  dataScope: string;
  /** Hébergeur souverain (immunité lois extracommunautaires) ? */
  sovereign: boolean;
};

export const HOSTING_LAYERS: HostingLayer[] = [
  {
    layer: "Frontend & API",
    provider: "Vercel",
    region: "UE (CDG / FRA)",
    dataScope:
      "Pages et API de l'application. Les dossiers affichent des informations publiques sur des sociétés et leurs dirigeants ; les pages Démo n'utilisent que des fixtures anonymisées.",
    sovereign: false,
  },
  {
    layer: "Base de données",
    provider: "Neon (Postgres)",
    region: "Francfort (UE)",
    dataScope:
      "Dossiers, réponses brutes des sources (empreinte SHA-256), journal d'audit et jeux ouverts importés (sanctions, marchés publics, agréments…). Chiffré au repos.",
    sovereign: false,
  },
  {
    layer: "Observabilité",
    provider: "Sentry",
    region: "US — scrubber beforeSend",
    dataScope: "Aucun payload personnel : retiré avant envoi.",
    sovereign: false,
  },
  {
    layer: "Sanctions et gels des avoirs",
    provider: "DG Trésor · listes États-Unis, Royaume-Uni, ONU, Suisse, Canada",
    region: "Importées dans la base (UE)",
    dataScope:
      "Listes publiques téléchargées puis conservées dans notre base : la consultation d'un dossier n'envoie aucune requête vers l'extérieur pour ces listes.",
    sovereign: true,
  },
  {
    layer: "Personnes politiquement exposées",
    provider: "OpenSanctions",
    region: "UE",
    dataScope:
      "En cours de mise en service : le contrôle des personnes politiquement exposées n'est pas encore actif.",
    sovereign: true,
  },
  {
    layer: "Sources officielles FR",
    provider: "Sirene · Recherche d'entreprises · BODACC · jeux ouverts de l'administration",
    region: "France",
    dataScope:
      "Interrogées en direct (SIREN ou nom de l'entité) ou importées dans la base. Détail et état de chaque source sur la page Sources.",
    sovereign: true,
  },
  {
    layer: "Registres étrangers",
    provider: "GLEIF · Companies House · Brønnøysund · ACRA",
    region: "Suisse · Royaume-Uni · Norvège · Singapour",
    dataScope:
      "Interrogés par identifiant public (LEI, numéro d'immatriculation) ; aucune autre donnée du dossier n'est transmise.",
    sovereign: false,
  },
  {
    layer: "Presse",
    provider: "GDELT Project",
    region: "États-Unis",
    dataScope:
      "Reçoit le nom de l'entité recherchée (requête de recherche). Aucun identifiant de dossier ni information sur ses dirigeants n'est transmis.",
    sovereign: false,
  },
  {
    layer: "Synthèse (LLM)",
    provider: "Aucun appel API tiers",
    region: "—",
    dataScope: "Workflow manuel : aucune donnée du dossier n'est transmise.",
    sovereign: true,
  },
];

export type SubProcessor = {
  name: string;
  service: string;
  region: string;
  dataScope: string;
  dpaUrl: string;
};

export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Vercel",
    service: "Hébergement frontend / API",
    region: "UE",
    dataScope:
      "Trafic applicatif : les pages et réponses des dossiers peuvent contenir des noms de dirigeants issus de registres publics.",
    dpaUrl: "https://vercel.com/legal/dpa",
  },
  {
    name: "Neon",
    service: "Base de données Postgres",
    region: "Francfort (UE)",
    dataScope: "Dossiers d'analyse, sources, journal d'audit.",
    dpaUrl: "https://neon.tech/dpa",
  },
  {
    name: "Sentry",
    service: "Observabilité erreurs / performance",
    region: "US",
    dataScope: "Traces techniques uniquement (payloads scrubbés).",
    dpaUrl: "https://sentry.io/legal/dpa/",
  },
  {
    name: "GitHub",
    service: "Exécution des imports planifiés de jeux ouverts",
    region: "États-Unis",
    dataScope:
      "Données publiques uniquement. L'accès à la base passe par un secret chiffré ; aucun dossier ni donnée de client ne transite.",
    dpaUrl: "https://github.com/customer-terms/github-data-protection-agreement",
  },
];

export const NOTIFICATION_COMMITMENT =
  "Tout changement de sous-traitant est notifié au moins 30 jours à l'avance.";

export type Certification = {
  name: string;
  status: "actuel" | "objectif";
  statusLabel: string;
  /** Échéance visée pour les objectifs. */
  target?: string;
  note: string;
};

export const CERTIFICATIONS: Certification[] = [
  {
    name: "RGPD (UE 2016/679)",
    status: "actuel",
    statusLabel: "Conforme par design",
    note: "Minimisation, intérêt légitime tracé, rétention 5 ans, scrubber des SaaS US.",
  },
  {
    name: "SOC 2 Type I",
    status: "objectif",
    statusLabel: "Objectif",
    target: "T4 2026",
    note: "Contrôles de sécurité audités par un tiers indépendant.",
  },
  {
    name: "SOC 2 Type II",
    status: "objectif",
    statusLabel: "Objectif",
    target: "T3 2027",
    note: "Efficacité des contrôles dans la durée.",
  },
  {
    name: "ISO/IEC 27001",
    status: "objectif",
    statusLabel: "Objectif",
    target: "T2 2027",
    note: "Système de management de la sécurité de l'information.",
  },
  {
    name: "SecNumCloud (hébergement)",
    status: "objectif",
    statusLabel: "Trajectoire",
    target: "déclenché au premier pilote signé",
    note: "Migration souveraine détaillée sur la page Souveraineté.",
  },
];

/** TODO: remplacer par l'adresse de contact sécurité réelle avant production. */
export const SECURITY_CONTACT = {
  email: "securite@kyb-graph.fr",
  statement:
    "Divulgation responsable : les chercheurs de bonne foi bénéficient d'un safe harbor. Signalez toute vulnérabilité avant publication.",
} as const;
