import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, timestamp, index, check } from "drizzle-orm/pg-core";

/** Métadonnées uniquement : les jeux ont chacun leur table, liée par import_id. */
export const openDataImports = pgTable("open_data_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  // Version du format de projection : un changement de champs force un réimport.
  version: text("version").notNull(),
  sourceUrl: text("source_url").notNull(),
  sha256: text("sha256"),
  recordCount: integer("record_count").notNull().default(0),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
}, (t) => [
  index("open_data_imports_latest_idx").on(t.source, t.status, t.importedAt),
  index("open_data_imports_attempt_idx").on(t.source, t.startedAt),
  check("open_data_imports_status_check", sql`${t.status} in ('running', 'ok', 'failed')`),
  check("open_data_imports_count_check", sql`${t.recordCount} >= 0`),
  check("open_data_imports_complete_check", sql`${t.status} <> 'ok' or (${t.sha256} is not null and ${t.sha256} ~ '^[a-f0-9]{64}$' and ${t.importedAt} is not null and ${t.checkedAt} is not null)`),
]);
