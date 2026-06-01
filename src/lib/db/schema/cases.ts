import { pgTable, uuid, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { caseStatus } from "./enums";

export const cases = pgTable("cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  rootSiren: text("root_siren").notNull(),
  title: text("title").notNull(),
  status: caseStatus("status").notNull().default("draft"),
  // Scores labellisés complexité / vigilance / qualité de preuve — JAMAIS « fraude ». (0–100)
  scoreComplexite: integer("score_complexite"),
  scoreVigilance: integer("score_vigilance"),
  scoreQualitePreuve: integer("score_qualite_preuve"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // SEAM (phases ultérieures) : workspaceId / ownerId pour workspaces + RBAC.
});
