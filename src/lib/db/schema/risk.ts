import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { severity, evidenceLevel } from "./enums";
import { cases } from "./cases";

export const riskSignals = pgTable(
  "risk_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(), // 'DIRIGEANT_MULTI_SOCIETES'
    subjectType: text("subject_type").notNull(), // 'entity'|'edge'|'case'
    subjectId: uuid("subject_id"),
    severity: severity("severity").notNull(),
    evidenceLevel: evidenceLevel("evidence_level").notNull().default("inferred"),
    // Catégorie sur l'axe vigilance/complexité/qualité — JAMAIS « fraude ».
    category: text("category").notNull(), // 'complexite'|'vigilance'|'qualite_preuve'
    explanation: text("explanation").notNull(), // phrase FR lisible
    data: jsonb("data").$type<Record<string, unknown>>().default({}), // { count, threshold }
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("risk_signals_case_idx").on(t.caseId)],
);
