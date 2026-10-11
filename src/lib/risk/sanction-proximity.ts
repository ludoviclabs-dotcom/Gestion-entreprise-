import type { CaseBundle } from "@/lib/graph/graph-types";

/** Au-delà de ce nombre de sauts, une société n'est plus signalée comme proche. */
export const SANCTION_MAX_HOPS = 2;

export type SanctionProximity = {
  /** Distance (en sauts) au nœud sanction le plus proche ; 0 pour le nœud lui-même. */
  dist: Map<string, number>;
  /** Prédécesseur sur le plus court chemin vers un nœud sanction (et libellé de l'arête). */
  pred: Map<string, { from: string; via: string }>;
  /** Nœud sanction à l'origine du plus court chemin (celui qui a atteint le nœud en premier). */
  root: Map<string, string>;
};

/**
 * Parcours en largeur (non dirigé, multi-source) depuis tous les nœuds sanction.
 * Source unique de vérité : la règle PROXIMITE_SANCTION décrit le chemin retenu, et
 * la provenance du signal (case-quality) rattache le signal au nœud sanction de CE
 * même chemin — jamais à un ensemble de sources valable pour tout le dossier.
 */
export function computeSanctionProximity(
  bundle: Pick<CaseBundle, "entities" | "edges">,
): SanctionProximity {
  const dist = new Map<string, number>();
  const pred = new Map<string, { from: string; via: string }>();
  const root = new Map<string, string>();
  const sanctions = bundle.entities.filter((e) => e.type === "sanction");
  if (sanctions.length === 0) return { dist, pred, root };

  // Adjacence non dirigée + libellé de l'arête (pour décrire le chemin).
  const adj = new Map<string, { node: string; via: string }[]>();
  const link = (a: string, b: string, label: string) => {
    const list = adj.get(a) ?? [];
    list.push({ node: b, via: label });
    adj.set(a, list);
  };
  for (const e of bundle.edges) {
    const label = e.label ?? e.type;
    link(e.source, e.target, label);
    link(e.target, e.source, label);
  }

  const queue: string[] = [];
  for (const s of sanctions) {
    dist.set(s.id, 0);
    root.set(s.id, s.id);
    queue.push(s.id);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    const d = dist.get(node) ?? 0;
    if (d >= SANCTION_MAX_HOPS) continue;
    for (const { node: next, via } of adj.get(node) ?? []) {
      if (dist.has(next)) continue;
      dist.set(next, d + 1);
      pred.set(next, { from: node, via });
      root.set(next, root.get(node) ?? node);
      queue.push(next);
    }
  }
  return { dist, pred, root };
}
