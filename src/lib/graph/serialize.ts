import type Graph from "graphology";
import type {
  GraphDTO,
  GraphNodeDTO,
  GraphEdgeDTO,
  NodeKind,
  EdgeKind,
  EvidenceLevel,
} from "./graph-types";
import { EVIDENCE_EDGE_COLORS, EVIDENCE_EDGE_SIZE } from "./graph-types";

/** Sérialise un graphe Graphology (déjà layouté) en DTO consommable par le client. */
export function serializeGraph(graph: Graph): GraphDTO {
  const nodes: GraphNodeDTO[] = graph.mapNodes((id, attr) => ({
    id,
    label: String(attr.label ?? id),
    kind: (attr.kind ?? "company") as NodeKind,
    evidenceLevel: (attr.evidenceLevel ?? "declared") as EvidenceLevel,
    x: Number(attr.x ?? 0),
    y: Number(attr.y ?? 0),
    size: Number(attr.size ?? 8),
    color: String(attr.color ?? "#38bdf8"),
    cluster: Number(attr.cluster ?? 0),
  }));

  const edges: GraphEdgeDTO[] = graph.mapEdges((id, attr, source, target) => {
    const level = (attr.evidenceLevel ?? "declared") as EvidenceLevel;
    return {
      id,
      source,
      target,
      type: (attr.edgeKind ?? "DIRIGE") as EdgeKind,
      label: attr.label ? String(attr.label) : undefined,
      weight: attr.weight ? String(attr.weight) : undefined,
      evidenceLevel: level,
      color: EVIDENCE_EDGE_COLORS[level],
      size: EVIDENCE_EDGE_SIZE[level],
    };
  });

  return { nodes, edges };
}
