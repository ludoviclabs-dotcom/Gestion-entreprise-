import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { cases } from "./cases";

// Étape 3.4 — journal de preuve append-only hash-chaîné (« audit_logs »).
// Chaque entrée embarque le hash de la précédente (prev_hash) dans sa propre
// matière hachée (entry_hash) : toute altération a posteriori casse la chaîne
// (cf. src/lib/audit/hash-chain.ts → verifyChain). Répond à l'obligation AMLR
// de piste d'audit des décisions de vigilance (docs/regulatory.md).
// SEAM (Étape 2.2 Better-Auth) : actor_id pour imputer l'acteur (analyste,
// intérêt légitime UBO) — ajouté avec l'auth.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(), // 1-based, croissant par dossier
    kind: text("kind").notNull(), // ProofEventKind (text + union TS, comme evidence.subject_type)
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    // ISO 8601 verbatim (text, pas timestamptz) : cette chaîne de caractères
    // entre dans la matière hachée — la fidélité d'octets au rejeu prime sur
    // le confort SQL. created_at reste là pour l'exploitation.
    occurredAt: text("occurred_at").notNull(),
    prevHash: text("prev_hash").notNull(),
    entryHash: text("entry_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("audit_logs_case_seq_idx").on(t.caseId, t.seq)],
);
