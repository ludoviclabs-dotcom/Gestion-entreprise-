import { REG, type RegRef } from "@/lib/domain/regulatory-refs";

/**
 * Contenu de la page /souverainete — trajectoire d'hébergement SecNumCloud.
 * Source : docs/sovereignty.md. Données structurées pour un rendu testable
 * (même approche que sector-threats.ts).
 */

export const SOVEREIGNTY_STATUS = {
  badge: "Pilote sur données publiques réelles — Vercel / AWS",
  headline:
    "Aujourd'hui un pilote sur données publiques réelles, cible SecNumCloud qualifié.",
  body: "L'application tourne sur Vercel (États-Unis, CLOUD Act) et traite des informations issues de sources publiques — registres, annonces légales, listes de sanctions —, y compris des dirigeants de sociétés. Aucune donnée confidentielle de client n'y est importée. Cet hébergement est acceptable pour ce pilote, mais disqualifiant pour des données relevant de Tracfin, de l'ACPR, de la DGSI ou de la DINUM. Les pages Démo et les maquettes restent sur des données fictives anonymisées. La trajectoire ci-dessous matérialise la migration vers un hébergement qualifié SecNumCloud, déclenchée par des jalons commerciaux explicites.",
} as const;

/** Cadre réglementaire et doctrinal de la souveraineté. */
export const SOVEREIGNTY_FRAMEWORK: RegRef[] = [
  REG.CLOUD_AU_CENTRE,
  REG.SECNUMCLOUD,
  REG.SREN_ART31,
  REG.AMLR,
  REG.AMLA,
  REG.CJUE_UBO,
];

export type QualifiedProvider = {
  name: string;
  datacenters: string;
  note: string;
};

/** Fournisseurs SecNumCloud qualifiés (état mi-2026). */
export const QUALIFIED_PROVIDERS: QualifiedProvider[] = [
  {
    name: "OVHcloud",
    datacenters: "Gravelines, Roubaix, Strasbourg",
    note: "Pure player français, base de prix la plus large.",
  },
  {
    name: "Outscale (groupe Dassault)",
    datacenters: "Saint-Cloud",
    note: "Filiale française, intégration Dassault Systèmes.",
  },
  {
    name: "Scaleway (groupe Iliad)",
    datacenters: "Paris, Amsterdam",
    note: "Catalogue moderne (Postgres managé, Kubernetes).",
  },
  {
    name: "Numspot",
    datacenters: "France",
    note: "Coentreprise Bouygues / Docaposte / Dassault / Cloud Temple.",
  },
  {
    name: "Cloud Temple",
    datacenters: "France",
    note: "Filiale orientée défense, marché souverain.",
  },
  {
    name: "S3NS (Thales / Google)",
    datacenters: "France",
    note: "Qualifié SecNumCloud fin décembre 2025 — offre récente à surveiller.",
  },
];

export type SovereigntyComponent = {
  component: string;
  today: string;
  target: string;
  /** Déjà souverain aujourd'hui ? */
  sovereign: boolean;
};

/** Composants KYB Graph : aujourd'hui vs cible souveraine. */
export const SOVEREIGNTY_COMPONENTS: SovereigntyComponent[] = [
  {
    component: "Frontend Next.js",
    today: "Vercel (US)",
    target: "Self-hosting Docker (Coolify / Dokploy) sur OVHcloud Public Cloud",
    sovereign: false,
  },
  {
    component: "API / Server Actions",
    today: "Vercel Functions",
    target: "Idem, conteneurisé en région UE",
    sovereign: false,
  },
  {
    component: "Base Postgres",
    today: "Neon (AWS / EU)",
    target: "OVHcloud Postgres 17 ou Scaleway Managed PostgreSQL",
    sovereign: false,
  },
  {
    component: "Requêtes graphe",
    today: "Drizzle in-memory + Graphology",
    target: "Postgres + Apache AGE (interface GraphQueryRepository déjà en place)",
    sovereign: false,
  },
  {
    component: "Observabilité",
    today: "Sentry SaaS (US), scrubber beforeSend",
    target: "GlitchTip self-hosted ou Sentry on-prem EU",
    sovereign: false,
  },
  {
    component: "Sanctions et gels des avoirs",
    today: "DG Trésor et listes États-Unis, Royaume-Uni, ONU, Suisse, Canada, importées dans notre base",
    target: "Inchangé — déjà souverain à la consultation",
    sovereign: true,
  },
  {
    component: "Personnes politiquement exposées",
    today: "OpenSanctions (UE) — en cours de mise en service",
    target: "Inchangé — déjà souverain",
    sovereign: true,
  },
  {
    component: "Registres et jeux ouverts de l'administration française",
    today: "Sirene, BODACC, Recherche d'entreprises, jeux ouverts importés (HATVP, DECP, DGAL, Géorisques…)",
    target: "Inchangé — déjà souverain",
    sovereign: true,
  },
  {
    component: "Registres étrangers (GLEIF, Companies House, Brønnøysund, ACRA)",
    today: "Interrogés par identifiant public ; aucune autre donnée du dossier transmise",
    target: "Non substituable : registres publics étrangers, interrogés par identifiant public seulement",
    sovereign: false,
  },
  {
    component: "Presse (GDELT)",
    today: "GDELT Project (États-Unis) : reçoit le nom de l'entité recherchée",
    target: "À arbitrer selon le pilote : fournisseur européen ou désactivation",
    sovereign: false,
  },
  {
    component: "Synthèse (LLM)",
    today: "Aucun appel API tiers — workflow manuel",
    target: "Inchangé. Si auto-génération un jour : Mistral via Scaleway / OVHcloud AI",
    sovereign: true,
  },
];

export type MigrationStep = {
  trigger: string;
  action: string;
};

/** Jalons de migration déclenchés par des événements commerciaux. */
export const MIGRATION_STEPS: MigrationStep[] = [
  {
    trigger: "Pilote sur données publiques réelles",
    action:
      "Statut actuel — Vercel et Neon (UE) acceptables : aucune donnée confidentielle de client n'est importée ; les pages Démo restent sur fixtures.",
  },
  {
    trigger: "Premier prospect institutionnel concret",
    action:
      "Formaliser les sous-traitants (DPA), puis activer les sources en cours (INPI/RNE sur intérêt légitime documenté, OpenSanctions).",
  },
  {
    trigger: "Pilote sous accord de confidentialité",
    action: "Migrer la base vers OVHcloud Postgres EU + Apache AGE ; basculer Sentry vers GlitchTip.",
  },
  {
    trigger: "Contrat signé Tracfin / ACPR / CAC 40",
    action: "Migration complète Frontend + API hors Vercel, synthèse via LLM souverain, audit ANSSI préalable.",
  },
];
