import Graph from "graphology";
import type { CaseBundle } from "./graph-types";
import { NODE_COLORS } from "./graph-types";

/**
 * Degré STRUCTUREL d'un nœud : nombre de liens de structure (dirigeants,
 * détention, siège, adresse partagée…), SANS les arêtes « a publié » qui relient
 * une société à ses annonces. Le nombre de publications (BODACC, BALO, BOAMP…)
 * dépend de l'ancienneté et de la taille de l'entreprise, pas de la complexité de
 * son organisation : le compter ferait paraître « complexe » une société simple
 * mais très publiée.
 */
export function structuralDegree(graph: Graph, node: string): number {
  let published = 0;
  graph.forEachEdge(node, (_edge, attributes) => {
    if (attributes.edgeKind === "A_PUBLIE") published += 1;
  });
  return graph.degree(node) - published;
}

/**
 * Transforme un dossier (entities + edges + events) en graphe Graphology.
 * Les événements deviennent des nœuds de type "event" reliés par A_PUBLIE.
 * Fonction pure et exécutable côté serveur (Node) comme côté client.
 */
export function buildGraph(bundle: CaseBundle): Graph {
  const graph = new Graph({ type: "directed", multi: true });

  for (const entity of bundle.entities) {
    if (graph.hasNode(entity.id)) continue;
    graph.addNode(entity.id, {
      label: entity.label,
      kind: entity.type,
      evidenceLevel: entity.evidenceLevel,
      color: NODE_COLORS[entity.type],
      size: 8,
    });
  }

  for (const event of bundle.events) {
    if (!graph.hasNode(event.id)) {
      graph.addNode(event.id, {
        label: event.title,
        kind: "event",
        eventKind: event.kind,
        evidenceLevel: event.evidenceLevel,
        color: NODE_COLORS.event,
        size: 6,
      });
    }
    const edgeKey = `APUB:${event.id}`;
    if (graph.hasNode(event.entityId) && !graph.hasEdge(edgeKey)) {
      graph.addEdgeWithKey(edgeKey, event.entityId, event.id, {
        edgeKind: "A_PUBLIE",
        evidenceLevel: event.evidenceLevel,
        label: "a publié",
      });
    }
  }

  for (const edge of bundle.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    if (graph.hasEdge(edge.id)) continue;
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      edgeKind: edge.type,
      evidenceLevel: edge.evidenceLevel,
      label: edge.label ?? edge.type,
      weight: edge.weight,
    });
  }

  // Taille des nœuds proportionnelle au degré (les hubs ressortent).
  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    graph.setNodeAttribute(node, "size", Math.min(22, 7 + degree * 1.6));
  });

  return graph;
}
