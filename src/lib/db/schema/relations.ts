import { pgTable, uuid, text, jsonb, date, timestamp, index } from "drizzle-orm/pg-core";
import { edgeType, evidenceLevel, sourceKind } from "./enums";
import { cases } from "./cases";
import { entities } from "./entities";

export const edges = pgTable(
  "edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    type: edgeType("type").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    evidenceLevel: evidenceLevel("evidence_level").notNull().default("declared"),
    weight: text("weight"), // ex. « 60% » de détention
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("edges_case_idx").on(t.caseId),
    index("edges_source_idx").on(t.sourceId),
    index("edges_target_idx").on(t.targetId),
  ],
);

// Timeline juridique : annonces BODACC, créations, radiations, procédures…
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // procedure_collective|radiation|creation|modification|depot_comptes
    source: sourceKind("source").notNull(),
    occurredOn: date("occurred_on"),
    title: text("title").notNull(),
    evidenceLevel: evidenceLevel("evidence_level").notNull().default("confirmed"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("events_case_idx").on(t.caseId)],
);
