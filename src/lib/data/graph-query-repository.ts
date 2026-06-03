import Graph from "graphology";
import { buildGraph } from "@/lib/graph/build-graph";
import {
  computeGraphMetrics,
  shortestEvidenceWeightedPath,
} from "@/lib/graph/algorithms";
import type { GraphMetrics } from "@/lib/graph/algorithms";
import type { CaseBundle } from "@/lib/graph/graph-types";

/**
 * Interface des requêtes de graphe avancées (path-finding, centralité,
 * communautés). Volontairement Cypher-shaped pour faciliter une bascule
 * future vers Apache AGE (extension Postgres openCypher, alignée avec le
 * narratif souverain SecNumCloud — cf. docs/sovereignty.md).
 *
 * À court terme, on l'implémente avec Graphology côté Node (rapide pour les
 * tailles de dossier KYB courantes < 1 000 nœuds).
 */
export interface GraphQueryRepository {
  /** Plus court chemin entre deux entités, pondéré par le niveau de preuve. */
  shortestPath(
    bundle: CaseBundle,
    sourceId: string,
    targetId: string,
  ): Promise<string[] | null>;
  /** Métriques structurelles (centralité, communautés, cycles). */
  metrics(bundle: CaseBundle): Promise<GraphMetrics>;
  /** Sous-graphe autour d'un nœud à profondeur donnée (expand-collapse). */
  expandSubgraph(
    bundle: CaseBundle,
    rootId: string,
    depth: number,
  ): Promise<{ nodes: string[]; edges: string[] }>;
}

/**
 * Implémentation Graphology in-memory. Le bundle est rebuild en Graph à
 * chaque appel (cheap car O(n+m) pour quelques centaines de nœuds).
 * Pour passer à Apache AGE : remplacer chaque méthode par une requête
 * Cypher côté Postgres+AGE — l'API publique ne change pas.
 */
export class GraphologyQueryRepository implements GraphQueryRepository {
  async shortestPath(
    bundle: CaseBundle,
    sourceId: string,
    targetId: string,
  ): Promise<string[] | null> {
    const g = buildGraph(bundle);
    return shortestEvidenceWeightedPath(g, sourceId, targetId);
  }

  async metrics(bundle: CaseBundle): Promise<GraphMetrics> {
    const g = buildGraph(bundle);
    return computeGraphMetrics(g);
  }

  async expandSubgraph(
    bundle: CaseBundle,
    rootId: string,
    depth: number,
  ): Promise<{ nodes: string[]; edges: string[] }> {
    const g = buildGraph(bundle);
    if (!g.hasNode(rootId)) return { nodes: [], edges: [] };
    // BFS borné par la profondeur.
    const seen = new Set<string>([rootId]);
    const edges = new Set<string>();
    let frontier: string[] = [rootId];
    for (let d = 0; d < depth; d += 1) {
      const next: string[] = [];
      for (const node of frontier) {
        g.forEachNeighbor(node, (neighbor) => {
          if (!seen.has(neighbor)) {
            seen.add(neighbor);
            next.push(neighbor);
          }
        });
        g.forEachEdge(node, (edge) => edges.add(edge));
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
    return { nodes: Array.from(seen), edges: Array.from(edges) };
  }
}

/**
 * Stub `AgeCypherRepository` — Apache AGE n'est pas encore branché. Toute
 * méthode lève une erreur explicite. Préparation Étape 3 souveraine
 * (Postgres + AGE sur SecNumCloud).
 */
export class AgeCypherRepository implements GraphQueryRepository {
  private notWired(): never {
    throw new Error(
      "AgeCypherRepository non raccordé — l'extension Apache AGE n'est pas activée. Étape 3 souveraine, cf. docs/sovereignty.md.",
    );
  }
  async shortestPath(): Promise<string[] | null> {
    return this.notWired();
  }
  async metrics(): Promise<GraphMetrics> {
    return this.notWired();
  }
  async expandSubgraph(): Promise<{ nodes: string[]; edges: string[] }> {
    return this.notWired();
  }
}

let _repo: GraphQueryRepository | null = null;

/**
 * Sélecteur singleton. Aujourd'hui : Graphology in-memory. Plus tard :
 * AgeCypherRepository quand Apache AGE est branché côté BDD.
 */
export function getGraphQueryRepository(): GraphQueryRepository {
  if (_repo) return _repo;
  // Le flag GRAPH_QUERY_BACKEND="age" permet de basculer une fois AGE prêt.
  if (process.env.GRAPH_QUERY_BACKEND === "age") {
    _repo = new AgeCypherRepository();
  } else {
    _repo = new GraphologyQueryRepository();
  }
  return _repo;
}

// Variable consommée par Graph dynamic build — silence l'avertissement
// no-unused-vars en cas d'optimisation Tree-shake.
void Graph;
