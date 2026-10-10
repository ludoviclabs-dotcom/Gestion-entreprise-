import { pgTable, uuid, text, date, boolean, primaryKey, index } from "drizzle-orm/pg-core";
import { openDataImports } from "./open-data";

export const caminoTitres = pgTable("camino_titres", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  titleId: text("title_id").notNull(),
  siren: text("siren").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  domain: text("domain").notNull(),
  status: text("status").notNull(),
  substances: text("substances").notNull(),
  departments: text("departments").notNull(),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  holder: boolean("holder").notNull(),
  operator: boolean("operator").notNull(),
}, t => [primaryKey({ columns: [t.importId, t.titleId, t.siren] }),
  index("camino_titres_siren_idx").on(t.siren, t.importId)]);
