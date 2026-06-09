/**
 * Modèle data-driven du mini-graphe du mockup (démo landing). Aucune dépendance
 * UI : types + données + helpers géométriques purs. Les couleurs sont des tokens
 * `--kyb-*` (consommés en `style` inline sous un ancêtre `.landing-scope`) ou des
 * rgba littéraux pour les arêtes.
 *
 * Le rendu se fait dans un viewBox 640×420 (unités « pixel-like ») : tailles de
 * trait/police lisibles, contrairement à l'ancien viewBox 0–100.
 */

export type MockNodeType =
  | "company"
  | "person"
  | "source"
  | "address"
  | "risk"
  | "foreign";

export type MockEdgeType =
  | "ownership"
  | "address"
  | "source"
  | "risk"
  | "correspondence";

export type MockNodeStatus = "verified" | "warning" | "risk" | "neutral";
export type LabelPosition = "top" | "right" | "bottom" | "left";

export interface GraphNode {
  id: string;
  label: string;
  type: MockNodeType;
  x: number;
  y: number;
  radius: number;
  labelPosition?: LabelPosition;
  status?: MockNodeStatus;
  main?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: MockEdgeType;
  dashed?: boolean;
}

export const GRAPH_VIEWBOX = { width: 640, height: 420 };

export const MOCK_NODES: GraphNode[] = [
  { id: "holding", label: "HOLDING PATRIMONIALE SAS", type: "company", x: 320, y: 210, radius: 18, labelPosition: "right", status: "verified", main: true },
  { id: "jean", label: "Jean MARTIN", type: "person", x: 205, y: 96, radius: 13, labelPosition: "top", status: "verified" },
  { id: "sci1", label: "SCI LES TILLEULS", type: "company", x: 398, y: 80, radius: 12, labelPosition: "top", status: "neutral" },
  { id: "sci2", label: "SCI DU PARC", type: "company", x: 150, y: 322, radius: 12, labelPosition: "left", status: "neutral" },
  { id: "addr", label: "8 av. du Parc", type: "address", x: 112, y: 188, radius: 11, labelPosition: "top", status: "verified" },
  { id: "rcs", label: "Immatriculation RCS", type: "source", x: 506, y: 152, radius: 11, labelPosition: "bottom", status: "verified" },
  { id: "corr", label: "« MARTIN HOLDING LTD »", type: "foreign", x: 486, y: 332, radius: 13, labelPosition: "bottom", status: "risk" },
  { id: "bod", label: "Jugement (BODACC)", type: "risk", x: 300, y: 362, radius: 11, labelPosition: "bottom", status: "warning" },
];

export const MOCK_EDGES: GraphEdge[] = [
  { id: "e1", source: "holding", target: "jean", type: "ownership", label: "dirigé par" },
  { id: "e2", source: "holding", target: "sci1", type: "ownership", label: "détient" },
  { id: "e3", source: "holding", target: "addr", type: "address" },
  { id: "e4", source: "holding", target: "sci2", type: "ownership", label: "détient" },
  { id: "e5", source: "holding", target: "rcs", type: "source" },
  { id: "e6", source: "holding", target: "corr", type: "correspondence", dashed: true },
  { id: "e7", source: "sci2", target: "bod", type: "risk", dashed: true },
  { id: "e8", source: "jean", target: "sci1", type: "ownership" },
];

/** Remplissage des nœuds par type (palette landing, daltonien-friendly). */
export const NODE_FILL: Record<MockNodeType, string> = {
  company: "var(--kyb-violet-soft)",
  person: "#e89bd0",
  source: "var(--kyb-green)",
  address: "var(--kyb-text-low)",
  risk: "var(--kyb-amber)",
  foreign: "var(--kyb-orange)",
};

export const NODE_TYPE_LABEL: Record<MockNodeType, string> = {
  company: "Société",
  person: "Personne",
  source: "Source",
  address: "Adresse",
  risk: "Risque",
  foreign: "Étranger",
};

/** Couleur des arêtes par type sémantique. */
export const EDGE_STROKE: Record<MockEdgeType, string> = {
  ownership: "rgba(124,92,255,0.55)",
  address: "rgba(164,169,196,0.4)",
  source: "rgba(74,222,155,0.5)",
  risk: "rgba(255,146,72,0.6)",
  correspondence: "rgba(245,181,68,0.6)",
};

const NODE_BY_ID = new Map(MOCK_NODES.map((n) => [n.id, n]));
export const findNode = (id: string): GraphNode | undefined => NODE_BY_ID.get(id);

export interface EdgeEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Points de départ/arrivée d'une arête : on part du centre des nœuds mais on
 * raccourcit le segment pour qu'il s'arrête au **bord** du cercle (rayon + pad),
 * jamais au centre — l'arête ne « vise » plus le texte.
 */
export function edgeEndpoints(
  source: GraphNode,
  target: GraphNode,
  pad = 3,
): EdgeEndpoints {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: source.x + cos * (source.radius + pad),
    y1: source.y + sin * (source.radius + pad),
    x2: target.x - cos * (target.radius + pad),
    y2: target.y - sin * (target.radius + pad),
  };
}

export interface LabelAnchor {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline: "auto" | "middle" | "hanging";
}

/** Position d'un libellé selon `labelPosition`, décalé hors du cercle. */
export function labelAnchor(node: GraphNode, gap = 7): LabelAnchor {
  const off = node.radius + gap;
  switch (node.labelPosition ?? "right") {
    case "top":
      return { x: node.x, y: node.y - off, textAnchor: "middle", dominantBaseline: "auto" };
    case "bottom":
      return { x: node.x, y: node.y + off, textAnchor: "middle", dominantBaseline: "hanging" };
    case "left":
      return { x: node.x - off, y: node.y, textAnchor: "end", dominantBaseline: "middle" };
    case "right":
    default:
      return { x: node.x + off, y: node.y, textAnchor: "start", dominantBaseline: "middle" };
  }
}
