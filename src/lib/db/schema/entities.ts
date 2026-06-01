import {
  pgTable,
  uuid,
  text,
  jsonb,
  date,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { entityType, evidenceLevel } from "./enums";
import { cases } from "./cases";

// Table de nœuds polymorphe ; les champs spécifiques vivent dans companies/persons/addresses.
export const entities = pgTable(
  "entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    type: entityType("type").notNull(),
    label: text("label").notNull(),
    evidenceLevel: evidenceLevel("evidence_level").notNull().default("declared"),
    naturalKey: text("natural_key"), // siren / sha1(adresse) / slug(personne) — dédoublonnage
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("entities_case_idx").on(t.caseId),
    unique("entities_case_naturalkey_uniq").on(t.caseId, t.type, t.naturalKey),
  ],
);

export const companies = pgTable("companies", {
  entityId: uuid("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  siren: text("siren").notNull(),
  siret: text("siret"),
  denomination: text("denomination"),
  formeJuridique: text("forme_juridique"),
  nafCode: text("naf_code"),
  nafLabel: text("naf_label"),
  dateCreation: date("date_creation"),
  trancheEffectif: text("tranche_effectif"),
  etatAdministratif: text("etat_administratif"), // 'A' active / 'C' cessée
  capitalSocial: text("capital_social"), // rarement en open data ; INPI plus tard
});

export const persons = pgTable("persons", {
  entityId: uuid("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  nom: text("nom"),
  prenoms: text("prenoms"),
  qualite: text("qualite"), // 'Président', 'Gérant'…
  dateNaissancePartielle: text("date_naissance_partielle"), // MM/YYYY quand dispo
  nationalite: text("nationalite"),
});

export const addresses = pgTable("addresses", {
  entityId: uuid("entity_id")
    .primaryKey()
    .references(() => entities.id, { onDelete: "cascade" }),
  ligne: text("ligne"),
  codePostal: text("code_postal"),
  commune: text("commune"),
  pays: text("pays").default("France"),
  normalized: text("normalized"), // forme canonique = base du naturalKey
});
