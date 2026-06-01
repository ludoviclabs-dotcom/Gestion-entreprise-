import type Graph from "graphology";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import { dijkstra } from "graphology-shortest-path";
import louvain from "graphology-communities-louvain";
import { stronglyConnectedComponents } from "graphology-components";
import type { EvidenceLevel } from "./graph-types";

// ── Centralité, communautés, cycles ──────────────────────────────────────

export type GraphMetrics = {
  /** Betweenness centrality par nœud (rôle de pivot). */
  betweenness: Record<string, number>;
  /** Identifiant de communauté Louvain par nœud. */
  communities: Record<string, number>;
  /** SCC ≥ 2 nœuds = cycles dirigés. */
  cycles: string[][];
  /** Nœud avec le plus haut betweenness (ou null si graphe trivial). */
  topPivot: { id: string; score: number } | null;
};

/**
 * Calcule les métriques structurelles d'un graphe. Pure : ne modifie pas le
 * graphe d'entrée. Pour les gros graphes (> 5 000 nœuds), à déporter dans
 * un Web Worker (cf. Étape 2.7).
 */
export function computeGraphMetrics(graph: Graph): GraphMetrics {
  if (graph.order === 0) {
    return { betweenness: {}, communities: {}, cycles: [], topPivot: null };
  }

  let betweenness: Record<string, number> = {};
  try {
    betweenness = betweennessCentrality(graph, { normalized: true });
  } catch {
    // graphology-metrics peut faillir sur des graphes très petits/déconnectés.
    graph.forEachNode((node) => {
      betweenness[node] = 0;
    });
  }

  let communities: Record<string, number> = {};
  try {
    communities = louvain(graph);
  } catch {
    let i = 0;
    graph.forEachNode((node) => {
      communities[node] = i;
      i += 1;
    });
  }

  let cycles: string[][] = [];
  try {
    cycles = stronglyConnectedComponents(graph).filter((c) => c.length >= 2);
  } catch {
    cycles = [];
  }

  let topPivot: { id: string; score: number } | null = null;
  for (const [id, score] of Object.entries(betweenness)) {
    if (!topPivot || score > topPivot.score) topPivot = { id, score };
  }

  return { betweenness, communities, cycles, topPivot };
}

// ── Path-finding (Dijkstra pondéré par niveau de preuve) ─────────────────

const EVIDENCE_WEIGHT: Record<EvidenceLevel, number> = {
  confirmed: 1,
  declared: 2,
  inferred: 6,
  simulated: 12,
};

/**
 * Plus court chemin entre deux nœuds, pondéré par la solidité des liens :
 * un chemin de liens `confirmed` est préféré à un chemin équivalent passant
 * par des liens `inferred`. Renvoie la séquence de nœuds (incluant les
 * extrémités) ou `null` si non connecté.
 */
export function shortestEvidenceWeightedPath(
  graph: Graph,
  source: string,
  target: string,
): string[] | null {
  if (!graph.hasNode(source) || !graph.hasNode(target)) return null;
  if (source === target) return [source];
  // Cloner avec poids dérivés du evidenceLevel — Dijkstra a besoin d'un
  // attribut numérique `weight` (ou un getter explicite).
  const copy = graph.copy();
  copy.forEachEdge((edge, attrs) => {
    const lvl = (attrs.evidenceLevel ?? "declared") as EvidenceLevel;
    copy.setEdgeAttribute(edge, "weight", EVIDENCE_WEIGHT[lvl]);
  });
  try {
    const path = dijkstra.bidirectional(copy, source, target, "weight");
    return path && path.length > 0 ? path : null;
  } catch {
    return null;
  }
}
