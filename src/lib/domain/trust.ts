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
    dataScope: "Aucune donnée personnelle réelle ne transite par le frontend.",
    sovereign: false,
  },
  {
    layer: "Base de données",
    provider: "Neon (Postgres)",
    region: "Francfort (UE)",
    dataScope: "Dossiers et sources chiffrés ; en démo, fixtures anonymisées.",
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
    layer: "Sanctions / PEP",
    provider: "OpenSanctions",
    region: "UE",
    dataScope: "Données publiques de sanctions et PEP.",
    sovereign: true,
  },
  {
    layer: "Sources officielles FR",
    provider: "Sirene · BODACC · INPI · DG Trésor",
    region: "France",
    dataScope: "Registres publics interrogés en temps réel (mode live).",
    sovereign: true,
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
    dataScope: "Trafic applicatif, pas de donnée personnelle réelle.",
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
