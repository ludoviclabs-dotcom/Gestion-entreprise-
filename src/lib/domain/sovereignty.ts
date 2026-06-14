import { REG, type RegRef } from "@/lib/domain/regulatory-refs";

/**
 * Contenu de la page /souverainete — trajectoire d'hébergement SecNumCloud.
 * Source : docs/sovereignty.md. Données structurées pour un rendu testable
 * (même approche que sector-threats.ts).
 */

export const SOVEREIGNTY_STATUS = {
  badge: "Démonstrateur — Vercel / AWS, données fictives anonymisées",
  headline:
    "Aujourd'hui démonstrateur souverain par construction, cible SecNumCloud qualifié.",
  body: "Les démos publiques tournent sur Vercel (États-Unis, CLOUD Act) sur des données fictives anonymisées — acceptable pour une démonstration, mais disqualifiant pour des données réelles relevant de Tracfin, de l'ACPR, de la DGSI ou de la DINUM. La trajectoire ci-dessous matérialise la migration vers un hébergement qualifié SecNumCloud, déclenchée par des jalons commerciaux explicites.",
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
    component: "Sanctions / PEP",
    today: "OpenSanctions (API SaaS, UE)",
    target: "Auto-hébergeable via yente (FastAPI + Elasticsearch, UE)",
    sovereign: true,
  },
  {
    component: "Sirene / BODACC / INPI / DG Trésor",
    today: "API gouvernementales françaises",
    target: "Inchangé — déjà souverain",
    sovereign: true,
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
    trigger: "Démo publique sur fixtures",
    action: "Statut actuel — Vercel acceptable, aucune donnée réelle traitée.",
  },
  {
    trigger: "Premier prospect institutionnel concret",
    action: "Provisionner Neon EU et activer les connecteurs live.",
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
