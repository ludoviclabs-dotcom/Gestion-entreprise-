import type { SourceKind } from "@/lib/graph/source";

/** Résultat brut d'un connecteur — alimente directement source_records. */
export interface ConnectorResult<TRaw> {
  raw: TRaw;
  endpoint: string; // URL exacte appelée, ou 'fixture:<nom>'
  httpStatus: number; // 0 pour une fixture
  isFixture: boolean;
}

/** Entrée de source_records (persistée en Phase 2 DB). */
export interface SourceRecordInput {
  source: SourceKind;
  endpoint: string;
  httpStatus: number;
  raw: unknown;
  isFixture: boolean;
}
