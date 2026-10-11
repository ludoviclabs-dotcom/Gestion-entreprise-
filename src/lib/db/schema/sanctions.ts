import { pgTable, uuid, text, jsonb, date, primaryKey, index } from "drizzle-orm/pg-core";
import { openDataImports } from "./open-data";

/**
 * Listes de sanctions et de contrôle INTERNATIONALES (États-Unis, Royaume-Uni,
 * ONU, Suisse, Canada) — projection minimale.
 *
 * Une table pour les cinq listes (`list_key`), liée à un import par liste
 * (`open_data_imports.source` = sanctions_us | uk | un | ch | ca). Organisations ;
 * personnes physiques (`kind = 'person'`, version d'import v3) pour le contrôle des
 * dirigeants, avec nom, alias, ANNÉES de naissance et pays seulement. Aucun navire,
 * aucune adresse, aucun identifiant personnel, aucun commentaire.
 *
 * `keys` : préfixes (5 caractères) des mots significatifs du nom et des alias,
 * pré-filtre SQL avant le rapprochement fin (jamais plus permissif que lui).
 * `kind` : `entity` (organisation typée comme telle par la liste, ou nom
 * d'allure d'organisation) ou `unknown` (type non précisé : conservé pour ne pas
 * manquer une société, jamais présenté comme un signal) ou `person`.
 * `birth_years` : années de naissance (personnes ; jamais la date complète).
 */
export const sanctionsEntries = pgTable("sanctions_entries", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  listKey: text("list_key").notNull(),
  entryKey: text("entry_key").notNull(),
  sublist: text("sublist"),
  name: text("name").notNull(),
  aliases: jsonb("aliases").notNull().default([]),
  keys: jsonb("keys").notNull().default([]),
  programs: jsonb("programs").notNull().default([]),
  countries: jsonb("countries").notNull().default([]),
  listedOn: date("listed_on"),
  kind: text("kind").notNull(),
  birthYears: jsonb("birth_years").notNull().default([]),
}, (t) => [
  primaryKey({ columns: [t.importId, t.entryKey] }),
  // Pré-filtre `keys ?| …` accéléré (contrôle de plusieurs personnes par dossier).
  index("sanctions_entries_keys_gin").using("gin", t.keys),
]);
