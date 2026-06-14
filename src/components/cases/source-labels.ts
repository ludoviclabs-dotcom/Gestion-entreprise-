import type { SourceKind } from "@/lib/graph/source";

/** Libellés FR des sources (partagés onglet Sources / inspecteur de preuve). */
export const SOURCE_LABELS: Record<SourceKind, string> = {
  sirene: "INSEE Sirene",
  bodacc: "BODACC",
  inpi: "INPI / RNE",
  tresor_gels: "DG Tresor - gels",
  opensanctions: "OpenSanctions",
  docling: "Docling — extraction",
  manual: "Manuel",
  fixture: "Fixture",
};

export const SUBJECT_LABELS = {
  entity: "Entite",
  edge: "Lien",
  event: "Evenement",
  risk_signal: "Signal",
} as const;
