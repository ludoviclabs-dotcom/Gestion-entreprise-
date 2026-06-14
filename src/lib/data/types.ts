import type {
  CaseBundle,
  CaseEdge,
  CaseEntity,
  CaseScores,
  EvidenceLevel,
} from "@/lib/graph/graph-types";
import type { SourceKind } from "@/lib/graph/source";
import type { SourceRecordInput } from "@/lib/connectors/types";
import type { ProofEvent, ProofEventKind } from "@/lib/audit/journal";

/** Statut d'un dossier (miroir de l'enum Drizzle case_status). */
export type CaseStatus = "draft" | "enriching" | "ready" | "error";
export type CaseOrigin = "live" | "mixed" | "fixture" | "unknown";
export type ScoreStatus = "computed" | "partial" | "missing" | "error";

export type SourceHealth = {
  origin: CaseOrigin;
  total: number;
  live: number;
  fixture: number;
  failed: number;
};

/** Ligne légère pour dashboard/liste (pas le bundle complet). */
export type CaseSummary = {
  id: string;
  title: string;
  rootSiren: string;
  status: CaseStatus;
  origin: CaseOrigin;
  scoreStatus: ScoreStatus;
  sourceHealth: SourceHealth;
  scores: CaseScores;
  counts: { entities: number; edges: number; signalsHigh: number };
  lastRunAt: string;
  updatedAt: string; // ISO
};

/** Résultat de recherche société (même forme que /api/search). */
export type CompanyCandidate = {
  siren: string;
  denomination: string | null;
  naf: string | null;
  etat: string | null;
};

/** Ligne du trail de provenance (source_records). */
export type SourceRow = {
  source: SourceKind;
  endpoint: string;
  httpStatus: number;
  isFixture: boolean;
};

export type EvidenceRow = {
  subjectType: "entity" | "edge" | "event" | "risk_signal";
  subjectId: string;
  source: SourceKind | null;
  sourceRecordId?: string;
  level: EvidenceLevel;
  excerpt?: string;
  pointer?: Record<string, unknown>;
};

export type CaseDetail = {
  bundle: CaseBundle;
  sources: SourceRow[];
  evidence: EvidenceRow[];
};

/**
 * Enregistrement source détaillé (payload brut + empreinte) pour
 * l'inspecteur de preuve. En BDD : ligne de source_records ; en démo :
 * payload d'exemple résolu depuis les fixtures.
 */
export type SourceRecordDetail = SourceRow & {
  id?: string;
  payload: unknown;
  payloadHash: string;
  requestedAt?: string;
};

/**
 * Contrat d'accès aux données. L'UI ne dépend QUE de cette interface.
 * Aujourd'hui : fixtures + assembleCase offline. Demain : Neon — UI inchangée.
 */
export interface CasesRepository {
  listCases(): Promise<CaseSummary[]>;
  getCase(id: string): Promise<CaseDetail | null>;
  searchCompanies(q: string): Promise<CompanyCandidate[]>;
  createCaseFromSiren(siren: string): Promise<CaseSummary>;
  /**
   * Enregistre la synthèse manuelle (workflow Claude Code) d'un dossier.
   * `referencedRuleIds` : règles déclenchées citées dans le texte (validées
   * en amont par l'action) — journalisées dans `synthese_enregistree`.
   */
  saveSynthesis(
    caseId: string,
    content: string,
    referencedRuleIds?: string[],
  ): Promise<void>;
  /**
   * Journal de preuve append-only hash-chaîné (Étape 3.4 « audit_logs »).
   * `appendProofEvent` chaîne après la tête courante du dossier ;
   * `listProofEvents` renvoie la chaîne complète ordonnée par `seq`.
   */
  appendProofEvent(
    caseId: string,
    kind: ProofEventKind,
    payload: Record<string, unknown>,
  ): Promise<void>;
  listProofEvents(caseId: string): Promise<ProofEvent[]>;
  /** Enregistrements source détaillés (payload brut) pour l'inspecteur de preuve. */
  getSourceRecords(caseId: string): Promise<SourceRecordDetail[]>;
  /**
   * Ajoute un document extrait (ex. Kbis via Docling) à un dossier : fusionne
   * les entités/liens extraits dans le bundle (résolution d'entités), recalcule
   * le risque et journalise la source. Implémenté pour les dossiers de session
   * (mode démo) ; la persistance BDD est une vague ultérieure.
   */
  addSourceDocument(
    caseId: string,
    sourceRecord: SourceRecordInput,
    extracted: { entities: CaseEntity[]; edges: CaseEdge[] },
  ): Promise<{ entities: number; edges: number; merged: number }>;
}
