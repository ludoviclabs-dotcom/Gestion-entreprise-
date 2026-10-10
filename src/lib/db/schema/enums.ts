import { pgEnum } from "drizzle-orm/pg-core";

export const entityType = pgEnum("entity_type", [
  "company",
  "person",
  "address",
  "event",
  "sanction",
]); // 'beneficial_owner' ajouté plus tard (accès restreint)

export const edgeType = pgEnum("edge_type", [
  "DIRIGE",
  "DETIENT",
  "PARTAGE_ADRESSE",
  "A_PUBLIE",
  "EST_VISE_PAR",
  "EMPLOIE",
]); // 'FLUX_FINANCIER' ajouté plus tard (FEC/Sankey)

export const evidenceLevel = pgEnum("evidence_level", [
  "confirmed",
  "declared",
  "inferred",
  "simulated",
]); // NON NÉGOCIABLE — porté par chaque node/edge/event/signal

export const severity = pgEnum("severity", ["info", "low", "medium", "high"]);

export const sourceKind = pgEnum("source_kind", [
  "sirene",
  "bodacc",
  "inpi",
  "tresor_gels",
  "opensanctions",
  "gleif",
  "vies",
  "ban",
  "gdelt",
  "pappers",
  "companies_house",
  "recherche_entreprises",
  "balo",
  "boamp",
  "joafe",
  "dca",
  "rge",
  "agence_bio",
  "alim_confiance",
  "qualiopi",
  "georisques",
  "annuaire_administration",
  "camino",
  "manual",
  "fixture",
]); // étendu au fil des connecteurs (cf. drizzle/ migrations)

export const caseStatus = pgEnum("case_status", [
  "draft",
  "enriching",
  "ready",
  "error",
]);
