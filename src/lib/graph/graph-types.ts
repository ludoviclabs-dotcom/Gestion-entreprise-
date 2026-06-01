// Types & constantes partagés du graphe — sûrs côté serveur ET client.

export type EvidenceLevel = "confirmed" | "declared" | "inferred" | "simulated";
export type NodeKind = "company" | "person" | "address" | "event" | "sanction";
export type EdgeKind =
  | "DIRIGE"
  | "DETIENT"
  | "PARTAGE_ADRESSE"
  | "A_PUBLIE"
  | "EST_VISE_PAR"
  | "EMPLOIE";
export type Severity = "info" | "low" | "medium" | "high";
export type RiskCategory = "complexite" | "vigilance" | "qualite_preuve";
export type LayerKey =
  | "gouvernance"
  | "capital"
  | "adresses"
  | "evenements"
  | "sanctions"
  | "risques";

// ── Données « métier » d'un dossier (fixtures + sortie de normalisation) ──
export type CaseEntity = {
  id: string;
  type: NodeKind;
  label: string;
  evidenceLevel: EvidenceLevel;
  attributes?: Record<string, string>;
  source?: string;
  excerpt?: string;
};
export type CaseEdge = {
  id: string;
  type: EdgeKind;
  source: string;
  target: string;
  label?: string;
  weight?: string;
  evidenceLevel: EvidenceLevel;
  sourceLabel?: string;
  excerpt?: string;
};
export type CaseEvent = {
  id: string;
  entityId: string;
  kind: string;
  title: string;
  occurredOn?: string;
  evidenceLevel: EvidenceLevel;
  source?: string;
};
export type CaseRiskSignal = {
  id: string;
  ruleId: string;
  subjectId?: string;
  severity: Severity;
  category: RiskCategory;
  explanation: string;
};
export type CaseScores = {
  complexite?: number;
  vigilance?: number;
  qualitePreuve?: number;
};
export type CaseBundle = {
  case: { id: string; title: string; rootSiren: string; scores?: CaseScores };
  entities: CaseEntity[];
  edges: CaseEdge[];
  events: CaseEvent[];
  riskSignals: CaseRiskSignal[];
};

// ── DTO de rendu (graphe pré-layouté envoyé au client) ──
export type GraphNodeDTO = {
  id: string;
  label: string;
  kind: NodeKind;
  evidenceLevel: EvidenceLevel;
  x: number;
  y: number;
  size: number;
  color: string;
  cluster: number;
};
export type GraphEdgeDTO = {
  id: string;
  source: string;
  target: string;
  type: EdgeKind;
  label?: string;
  weight?: string;
  evidenceLevel: EvidenceLevel;
  color: string;
};
export type GraphDTO = { nodes: GraphNodeDTO[]; edges: GraphEdgeDTO[] };

// ── Couleurs lisibles sur fond navy ──
export const NODE_COLORS: Record<NodeKind, string> = {
  company: "#38bdf8",
  person: "#a78bfa",
  address: "#94a3b8",
  event: "#f59e0b",
  sanction: "#ef4444",
};
export const NODE_LABELS: Record<NodeKind, string> = {
  company: "Société",
  person: "Personne",
  address: "Adresse",
  event: "Événement",
  sanction: "Sanction",
};
export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  confirmed: "Confirmé",
  declared: "Déclaré",
  inferred: "Inféré",
  simulated: "Simulé",
};
export const EVIDENCE_EDGE_COLORS: Record<EvidenceLevel, string> = {
  confirmed: "#cbd5e1",
  declared: "#7c8ba1",
  inferred: "#5b6b86",
  simulated: "#b45309",
};
export const EDGE_LABELS: Record<EdgeKind, string> = {
  DIRIGE: "dirige",
  DETIENT: "détient",
  PARTAGE_ADRESSE: "même adresse",
  A_PUBLIE: "a publié",
  EST_VISE_PAR: "visé par",
  EMPLOIE: "emploie",
};
export const LAYER_LABELS: Record<LayerKey, string> = {
  gouvernance: "Gouvernance",
  capital: "Capital",
  adresses: "Adresses",
  evenements: "Événements",
  sanctions: "Sanctions",
  risques: "Risques",
};
export const SEVERITY_COLORS: Record<Severity, string> = {
  info: "#64748b",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
};
export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
};

/** Une preuve inférée ou simulée n'est jamais un fait : à signaler dans l'UI. */
export function isHypothesis(level: EvidenceLevel): boolean {
  return level === "inferred" || level === "simulated";
}

export function layerForNodeKind(kind: string): LayerKey | null {
  switch (kind) {
    case "person":
      return "gouvernance";
    case "address":
      return "adresses";
    case "event":
      return "evenements";
    case "sanction":
      return "sanctions";
    default:
      return null; // company : toujours visible
  }
}

export function layerForEdgeType(type: string): LayerKey | null {
  switch (type) {
    case "DIRIGE":
    case "EMPLOIE":
      return "gouvernance";
    case "DETIENT":
      return "capital";
    case "PARTAGE_ADRESSE":
      return "adresses";
    case "A_PUBLIE":
      return "evenements";
    case "EST_VISE_PAR":
      return "sanctions";
    default:
      return null;
  }
}
