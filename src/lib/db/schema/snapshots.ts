import { pgTable, uuid, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { cases } from "./cases";

// Graphe versionné et pré-layouté (nœuds avec x/y/cluster + liens) pour un rendu instantané.
export const graphSnapshots = pgTable("graph_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  graph: jsonb("graph")
    .$type<{ nodes: unknown[]; edges: unknown[]; clusters: unknown[] }>()
    .notNull(),
  stats: jsonb("stats").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
