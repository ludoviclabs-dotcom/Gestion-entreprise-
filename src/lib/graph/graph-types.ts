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
/**
 * Famille structurelle d'un signal — axe de regroupement NON accusatoire
 * (jamais une infraction). Sert aux facettes du panneau de signaux. Défini ici
 * (module sûr client+serveur) car `rules.ts` importe graphology et ne peut donc
 * pas être chargé dans un composant client.
 */
export type RuleFamily =
  | "gouvernance"
  | "capital"
  | "adresse"
  | "evenement"
  | "sanctions"
  | "structure";
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
  /** Validité temporelle du lien (ISO date) — « qui contrôlait au moment T ». */
  validFrom?: string;
  validTo?: string;
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
  /** Niveau de preuve du SUJET du signal (dérivé, jamais inventé). Facette « Preuve du sujet ». */
  evidenceLevel?: EvidenceLevel;
};
export type CaseScores = {
  complexite?: number;
  vigilance?: number;
  qualitePreuve?: number;
};
/** Synthèse manuelle rédigée via Claude Code (workflow copier-coller). */
export type CaseSynthesis = { content: string; updatedAt: string };

/** Bénéficiaire effectif DÉCLARÉ au registre (INPI/RBE). Sert au calcul d'écart
 *  avec l'UBO recalculé depuis le capital. Transient (non persisté tel quel —
 *  l'écart est persisté via un risk signal + le journal `ecart_ubo_detecte`). */
export type DeclaredUbo = {
  label: string;
  nom?: string;
  prenoms?: string;
  modaliteControle?: string;
  /** Trace de provenance : endpoint INPI consulté + empreinte du payload brut. */
  sourceEndpoint?: string;
  sourcePayloadHash?: string;
};

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
  /** Bénéficiaires effectifs déclarés (INPI/RBE ou fixture) — pour l'écart UBO. */
  declaredUbo?: DeclaredUbo[];
  /** État antérieur du dossier (T0) pour le diff d'évolution T0 → T1. */
  previous?: { label: string; entities: CaseEntity[]; edges: CaseEdge[] };
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
/**
 * Libellés de la sévérité DISCRÈTE des signaux. Échelle volontairement distincte
 * de la bande d'EXPOSITION continue 0-100 des secteurs (sector-scoring.scoreLabel :
 * Maîtrisé/Modéré/Élevé/Critique) : deux axes sémantiques différents — ne pas
 * fusionner. Le partage lexical « Modéré »/« Élevé » est assumé.
 */
export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Faible",
  medium: "Modéré",
  high: "Élevé",
};

export const RULE_FAMILY_LABELS: Record<RuleFamily, string> = {
  gouvernance: "Gouvernance",
  capital: "Capital & détention",
  adresse: "Domiciliation",
  evenement: "Événements juridiques",
  sanctions: "Sanctions & PEP",
  structure: "Structure du réseau",
};

/**
 * Rattachement de chaque règle (par son `ruleId`) à une famille structurelle.
 * Source unique de vérité, sûre côté client (les signaux ne portent que leur
 * `ruleId`). Une règle absente de cette table retombe sur « structure ».
 */
export const RULE_FAMILY: Record<string, RuleFamily> = {
  DIRIGEANT_MULTI_SOCIETES: "gouvernance",
  ADRESSE_PARTAGEE: "adresse",
  SOCIETE_RECENTE_TRES_LIEE: "structure",
  PROCEDURE_COLLECTIVE: "evenement",
  RADIATION: "evenement",
  CYCLE_DETENTION: "capital",
  PIVOT_SUSPECT: "structure",
  ECART_UBO_DECLARE: "capital",
  PROXIMITE_SANCTION: "sanctions",
  // Typologies structurelles (M9)
  RELAIS_STRUCTUREL: "structure",
  CONCENTRATION_DOMICILIATION: "adresse",
  CHAINE_DETENTION_OPAQUE: "capital",
  // Rapprochement nominatif post-résolution d'entités
  RESOLUTION_SANCTION: "sanctions",
};

/** Famille d'un signal d'après son `ruleId` (défaut : « structure »). */
export function familyForRule(ruleId: string): RuleFamily {
  return RULE_FAMILY[ruleId] ?? "structure";
}

/** Comptes de signaux famille × sévérité (vue portefeuille V9). */
export type FamilySeverityCounts = Partial<
  Record<RuleFamily, Partial<Record<Severity, number>>>
>;

export function countSignalsByFamilySeverity(
  signals: { ruleId: string; severity: Severity }[],
): FamilySeverityCounts {
  const out: FamilySeverityCounts = {};
  for (const s of signals) {
    const fam = familyForRule(s.ruleId);
    const row = (out[fam] ??= {});
    row[s.severity] = (row[s.severity] ?? 0) + 1;
  }
  return out;
}

/** Rang ordinal des sévérités — source unique pour comparer/agréger. */
export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Sévérité maximale par sujet (`subjectId`) parmi des signaux. Source unique
 * réutilisée par la surcouche de risque du graphe et la timeline (évite de
 * dupliquer la table de rang + le réducteur).
 */
export function maxSeverityBySubject(
  signals: { subjectId?: string; severity: Severity }[],
): Map<string, Severity> {
  const out = new Map<string, Severity>();
  for (const s of signals) {
    if (!s.subjectId) continue;
    const cur = out.get(s.subjectId);
    if (!cur || SEVERITY_RANK[s.severity] > SEVERITY_RANK[cur]) {
      out.set(s.subjectId, s.severity);
    }
  }
  return out;
}

/**
 * Palette de communautés (Okabe-Ito étendue, distinguable par daltonisme).
 * Source unique : mode de coloration « par communauté » (GraphSceneSvg) + légende.
 */
export const COMMUNITY_COLORS = [
  "#56B4E9",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#999999",
  "#8DA0CB",
  "#A6D854",
];

/** Couleur stable d'une communauté Louvain (index modulo palette). */
export function communityColor(cluster: number): string {
  const n = COMMUNITY_COLORS.length;
  return COMMUNITY_COLORS[((cluster % n) + n) % n];
}

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
