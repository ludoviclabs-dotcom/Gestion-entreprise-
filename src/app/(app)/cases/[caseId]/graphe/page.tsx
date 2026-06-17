import { notFound } from "next/navigation";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeLayout } from "@/lib/graph/layout";
import { serializeGraph } from "@/lib/graph/serialize";
import GraphCanvas from "@/components/graph/GraphCanvas.client";
import { getCasesRepository } from "@/lib/data/cases-repository";
import type { GraphDTO } from "@/lib/graph/graph-types";

export default async function GrapheTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  // Layout calculé côté serveur (Graphology en Node) → coordonnées prêtes.
  // Tolérant : si la construction/le layout échoue pour un dossier précis (donnée
  // atypique), on sert un graphe vide plutôt que de faire planter tout l'écran —
  // l'en-tête, les onglets et les autres vues du dossier restent accessibles.
  // L'erreur réelle est journalisée côté serveur (logs Vercel) pour diagnostic.
  let dto: GraphDTO = { nodes: [], edges: [] };
  try {
    const graph = buildGraph(detail.bundle);
    computeLayout(graph);
    dto = serializeGraph(graph);
  } catch (error) {
    console.error(
      `[graphe] échec du calcul du graphe pour le dossier ${caseId}`,
      error,
    );
  }

  return (
    <div className="h-full">
      <GraphCanvas dto={dto} bundle={detail.bundle} />
    </div>
  );
}
