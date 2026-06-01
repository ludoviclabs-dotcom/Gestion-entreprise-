import type Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import louvain from "graphology-communities-louvain";

/**
 * Calcule un layout stable côté serveur : positions initiales circulaires
 * (déterministes) → communautés Louvain (attribut "cluster") → ForceAtlas2.
 * Les coordonnées sont ensuite persistées / envoyées au client (rendu instantané).
 */
export function computeLayout(graph: Graph): void {
  if (graph.order === 0) return;

  circular.assign(graph);

  if (graph.size > 0) {
    try {
      louvain.assign(graph, { nodeCommunityAttribute: "cluster" });
    } catch {
      graph.forEachNode((node) => graph.setNodeAttribute(node, "cluster", 0));
    }
  } else {
    graph.forEachNode((node) => graph.setNodeAttribute(node, "cluster", 0));
  }

  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, { iterations: 300, settings });
}
