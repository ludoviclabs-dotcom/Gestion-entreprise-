import { pgTable, uuid, text, boolean, integer, date, primaryKey, index } from "drizzle-orm/pg-core";
import { openDataImports } from "./open-data";
export const icpeSites = pgTable("icpe_sites", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  codeAiot: text("code_aiot").notNull(), siret: text("siret").notNull(), siren: text("siren").notNull(),
  name: text("name"), commune: text("commune"), naf: text("naf"), regime: text("regime"), seveso: text("seveso"),
  ied: boolean("ied"), nationalPriority: boolean("national_priority"), status: text("status"),
  inspections: integer("inspections").notNull(), lastInspection: date("last_inspection"),
}, t => [primaryKey({ columns: [t.importId, t.codeAiot] }), index("icpe_sites_siren_idx").on(t.siren, t.importId)]);
