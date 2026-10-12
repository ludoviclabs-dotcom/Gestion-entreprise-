import { sql } from "drizzle-orm";
import { pgTable, uuid, text, date, integer, numeric, jsonb, primaryKey, index, check } from "drizzle-orm/pg-core";
import { openDataImports } from "./open-data";

export const decpWindows = pgTable("decp_windows", {
  importId: uuid("import_id").primaryKey().references(() => openDataImports.id, { onDelete: "cascade" }),
  windowStart: date("window_start").notNull(), windowEnd: date("window_end").notNull(),
  latestFileMonth: text("latest_file_month").notNull(),
}, t => [check("decp_window_order", sql`${t.windowStart} <= ${t.windowEnd}`)]);

export const decpSummaries = pgTable("decp_summaries", {
  importId: uuid("import_id").notNull().references(() => openDataImports.id, { onDelete: "cascade" }),
  siren: text("siren").notNull(), role: text("role").notNull(), total: integer("total").notNull(),
  reliableAmount: numeric("reliable_amount").notNull(), singleReliable: integer("single_reliable").notNull(),
  grouped: integer("grouped").notNull(), unreliable: integer("unreliable").notNull(), lastNotified: date("last_notified").notNull(),
  buyers: jsonb("buyers").notNull(), items: jsonb("items").notNull(),
}, t => [primaryKey({ columns: [t.importId, t.siren, t.role] }),
  index("decp_summaries_siren_idx").on(t.siren, t.importId, t.role),
  check("decp_summary_role", sql`${t.role} in ('holder', 'buyer')`),
  check("decp_summary_counts", sql`${t.total} > 0 and ${t.singleReliable} >= 0 and ${t.grouped} >= 0 and ${t.unreliable} >= 0`),
  check("decp_summary_arrays", sql`jsonb_typeof(${t.buyers}) = 'array' and jsonb_array_length(${t.buyers}) <= 5 and jsonb_typeof(${t.items}) = 'array' and jsonb_array_length(${t.items}) <= 20`)]);
