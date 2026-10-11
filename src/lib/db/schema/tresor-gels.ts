import { pgTable, uuid, text, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { openDataImports } from "./open-data";

/**
 * Registre national des gels (DG Trésor) — personnes MORALES et navires
 * seulement. Les personnes physiques (≈ 70 % du registre) ne sont jamais
 * importées : le rapprochement les écarte déjà, elles n'ont donc aucune raison
 * d'être conservées (minimisation).
 *
 * Aucune clé par SIREN : le registre est lu en entier (≈ 2 000 lignes) puis
 * rapproché par dénomination, exactement comme le téléchargement direct.
 * `publication_date` et `register_total` sont constants pour un import donné
 * (date de publication du registre, nombre d'entrées TOUTES natures confondues).
 */
export const tresorGelsEntries = pgTable("tresor_gels_entries", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  nom: text("nom").notNull(),
  nature: text("nature"),
  aliases: jsonb("aliases").notNull().default([]),
  publicationDate: text("publication_date"),
  registerTotal: integer("register_total").notNull(),
}, t => [primaryKey({ columns: [t.importId, t.position] })]);
