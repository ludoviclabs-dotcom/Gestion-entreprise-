import { pgTable, uuid, text, date, jsonb, primaryKey, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { openDataImports } from "./open-data";
export const dgalApprovals = pgTable("dgal_approvals", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  siren: text("siren").notNull(), siret: text("siret").notNull(), approval: text("approval").notNull(), section: text("section").notNull(),
  categories: jsonb("categories").$type<string[]>().notNull(), associated: jsonb("associated").$type<string[]>().notNull(), exportedOn: date("exported_on"),
}, t => [primaryKey({ columns: [t.importId, t.siret, t.approval, t.section] }), index("dgal_approvals_siren_idx").on(t.siren, t.importId),
  check("dgal_identifiers", sql`${t.siren} ~ '^[0-9]{9}$' and ${t.siret} ~ '^[0-9]{14}$' and left(${t.siret}, 9) = ${t.siren}`),
  check("dgal_arrays", sql`jsonb_typeof(${t.categories}) = 'array' and jsonb_array_length(${t.categories}) <= 24 and jsonb_typeof(${t.associated}) = 'array' and jsonb_array_length(${t.associated}) <= 400`),
]);
