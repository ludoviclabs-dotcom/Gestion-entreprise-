import type { CaseBundle, CaseScores } from "@/lib/graph/graph-types";

/** Statut d'un dossier (miroir de l'enum Drizzle case_status). */
export type CaseStatus = "draft" | "enriching" | "ready" | "error";

/** Ligne légère pour dashboard/liste (pas le bundle complet). */
export type CaseSummary = {
  id: string;
  title: string;
  rootSiren: string;
  status: CaseStatus;
  scores: CaseScores;
  counts: { entities: number; edges: number; signalsHigh: number };
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
  source: string;
  endpoint: string;
  httpStatus: number;
  isFixture: boolean;
};

export type CaseDetail = { bundle: CaseBundle; sources: SourceRow[] };

/**
 * Contrat d'accès aux données. L'UI ne dépend QUE de cette interface.
 * Aujourd'hui : fixtures + assembleCase offline. Demain : Neon — UI inchangée.
 */
export interface CasesRepository {
  listCases(): Promise<CaseSummary[]>;
  getCase(id: string): Promise<CaseDetail | null>;
  searchCompanies(q: string): Promise<CompanyCandidate[]>;
  createCaseFromSiren(siren: string): Promise<CaseSummary>;
}
