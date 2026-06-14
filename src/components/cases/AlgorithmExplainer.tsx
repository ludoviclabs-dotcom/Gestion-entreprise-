import {
  ALGORITHM_EXPLAINERS,
  type AlgorithmId,
} from "@/lib/domain/algorithm-explainers";

/**
 * Encart « méthode » repliable : ce qu'un algorithme de graphe prouve et sa
 * limite. Additif (balise <details>), ne perturbe pas la mise en page existante.
 */
export function AlgorithmExplainer({ id }: { id: AlgorithmId }) {
  const e = ALGORITHM_EXPLAINERS[id];
  return (
    <details className="mt-3 rounded-lg border border-border bg-background p-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-foreground">
        Méthode — {e.title}
      </summary>
      <div className="mt-2 space-y-2">
        <p className="leading-6 text-muted-foreground">
          <span className="font-medium text-emerald">Ce que ça prouve. </span>
          {e.proves}
        </p>
        <p className="leading-6 text-muted-foreground">
          <span className="font-medium text-red">Sa limite. </span>
          {e.limit}
        </p>
        <p className="text-xs text-muted-foreground/70">{e.fn}</p>
      </div>
    </details>
  );
}
