import type Graph from "graphology";

/** Décision lot D : les dates Camino enrichissent le dossier sans effet de score. */
export function isInformationalEvent(event: { kind: string }): boolean {
  return event.kind === "titre_minier_debut" || event.kind === "titre_minier_echeance";
}

/** Copie de calcul partagée par le risque, l'Analyse et les requêtes de graphe.
 * Les événements fournis couvrent aussi un graphe sans métadonnée eventKind.
 * Le graphe affiché/exporté n'est jamais modifié. */
export function calculationGraph(graph: Graph, events: readonly { id: string; kind: string }[] = []): Graph {
  const known = new Set(events.filter(isInformationalEvent).map(e => e.id));
  const excluded = graph.filterNodes((id, attrs) => attrs.kind === "event" &&
    (known.has(id) || (typeof attrs.eventKind === "string" && isInformationalEvent({ kind: attrs.eventKind }))));
  if (!excluded.length) return graph;
  const copy = graph.copy();
  for (const id of excluded) copy.dropNode(id);
  return copy;
}
