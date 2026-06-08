import type {
  CaseBundle,
  CaseScores,
  EvidenceLevel,
} from "@/lib/graph/graph-types";
import type { SourceKind } from "@/lib/graph/source";

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
 * Contrat d'accès aux données. L'UI ne dépend QUE de cette interface.
 * Aujourd'hui : fixtures + assembleCase offline. Demain : Neon — UI inchangée.
 */
export interface CasesRepository {
  listCases(): Promise<CaseSummary[]>;
  getCase(id: string): Promise<CaseDetail | null>;
  searchCompanies(q: string): Promise<CompanyCandidate[]>;
  createCaseFromSiren(siren: string): Promise<CaseSummary>;
  /** Enregistre la synthèse manuelle (workflow Claude Code) d'un dossier. */
  saveSynthesis(caseId: string, content: string): Promise<void>;
}
