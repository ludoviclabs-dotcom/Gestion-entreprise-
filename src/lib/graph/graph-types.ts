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
/** Synthèse manuelle rédigée via Claude Code (workflow copier-coller). */
export type CaseSynthesis = { content: string; updatedAt: string };

export type CaseBundle = {
  case: {
    id: string;
    title: string;
    rootSiren: string;
    scores?: CaseScores;
    synthesis?: CaseSynthesis;
  };
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
  size: number; // taille du trait — encode aussi le niveau de preuve (a11y)
};
export type GraphDTO = { nodes: GraphNodeDTO[]; edges: GraphEdgeDTO[] };

// ── Couleurs lisibles sur fond navy (palette Okabe-Ito, colorblind-safe) ──
// Référence : Okabe & Ito (2008), couleurs distinguables par les principaux
// types de daltonisme (deutéranopie/protanopie). Audit WCAG 2.1/2.2.
export const NODE_COLORS: Record<NodeKind, string> = {
  company: "#56B4E9", // sky blue — distinguable rouge-vert
  person: "#CC79A7", // reddish purple
  address: "#999999", // neutral grey
  event: "#E69F00", // orange
  sanction: "#D55E00", // vermillion (distinct du orange)
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

/**
 * Double encodage du niveau de preuve : taille de trait en plus de la couleur.
 * Indispensable pour la lecture par les personnes daltoniennes (audit WCAG).
 * Sigma v3 ne supporte pas nativement les traits dashed sans shader custom ;
 * on encode donc par variation de largeur + opacité pour produire un
 * gradient lisible « plein → fin → fantôme ».
 */
export const EVIDENCE_EDGE_SIZE: Record<EvidenceLevel, number> = {
  confirmed: 3.5,
  declared: 2.2,
  inferred: 1.3,
  simulated: 1.0,
};
export const EVIDENCE_EDGE_OPACITY: Record<EvidenceLevel, number> = {
  confirmed: 1.0,
  declared: 0.85,
  inferred: 0.6,
  simulated: 0.45,
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
