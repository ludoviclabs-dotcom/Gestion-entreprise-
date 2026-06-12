import type { CaseDetail } from "./types";
import type { ProofEvent } from "@/lib/audit/journal";
import type { SourceRecordInput } from "@/lib/connectors/types";

/** Entrée de session : dossier + payloads bruts (inspecteur de preuve). */
type SessionEntry = CaseDetail & {
  updatedAt: string;
  sourceRecords?: SourceRecordInput[];
};

/**
 * Store module-level pour les dossiers créés en session (mode démo, sans BDD).
 * NON persistant : vidé au redémarrage du process, non partagé entre workers.
 * Suffisant pour une démo mono-utilisateur ; remplacé par Neon en phase secondaire.
 */
const store = new Map<string, SessionEntry>();

/**
 * Journal de preuve runtime (appends de session) — jumeau mémoire de la table
 * `audit_logs` pour le mode démo zéro-clé. Même doctrine d'éphémérité que
 * `sessionStore` ; les seeds des dossiers fixtures vivent à part
 * (cf. src/lib/audit/fixture-journal.ts).
 */
const journal = new Map<string, ProofEvent[]>();

export const journalStore = {
  list(caseId: string): ProofEvent[] {
    return journal.get(caseId) ?? [];
  },
  head(caseId: string): ProofEvent | undefined {
    const entries = journal.get(caseId);
    return entries?.[entries.length - 1];
  },
  append(caseId: string, event: ProofEvent): void {
    const entries = journal.get(caseId);
    if (entries) entries.push(event);
    else journal.set(caseId, [event]);
  },
};

export const sessionStore = {
  set(id: string, detail: SessionEntry): void {
    store.set(id, detail);
  },
  get(id: string): SessionEntry | undefined {
    return store.get(id);
  },
  all(): Array<[string, SessionEntry]> {
    return Array.from(store.entries());
  },
  has(id: string): boolean {
    return store.has(id);
  },
  /** Enregistre/met à jour la synthèse manuelle d'un dossier (Claude Code). */
  setSynthesis(id: string, content: string): boolean {
    const entry = store.get(id);
    if (!entry) return false;
    const updatedAt = new Date().toISOString();
    entry.bundle.case.synthesis = { content, updatedAt };
    entry.updatedAt = updatedAt;
    return true;
  },
};
