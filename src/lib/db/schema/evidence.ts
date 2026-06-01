import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sourceKind, evidenceLevel } from "./enums";
import { cases } from "./cases";

// Payloads API bruts — la chaîne de preuve (NON NÉGOCIABLE).
export const sourceRecords = pgTable(
  "source_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    source: sourceKind("source").notNull(),
    endpoint: text("endpoint").notNull(), // URL exacte appelée (ou 'fixture:<nom>')
    httpStatus: text("http_status"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(), // JSON renvoyé, verbatim
    payloadHash: text("payload_hash").notNull(), // sha256 (intégrité + dédup)
    isFixture: text("is_fixture").notNull().default("false"),
  },
  (t) => [index("source_records_case_idx").on(t.caseId)],
);

// Chaque node/edge/event/signal dérivé pointe vers le(s) source_record(s) qui le justifient.
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(), // 'entity'|'edge'|'event'|'risk_signal'
    subjectId: uuid("subject_id").notNull(),
    sourceRecordId: uuid("source_record_id").references(() => sourceRecords.id, {
      onDelete: "set null",
    }),
    level: evidenceLevel("level").notNull(),
    excerpt: text("excerpt"), // justification lisible (« Dirigeant déclaré au RCS »)
    pointer: jsonb("pointer").$type<Record<string, unknown>>().default({}), // chemin JSON dans le payload
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("evidence_subject_idx").on(t.subjectType, t.subjectId)],
);
