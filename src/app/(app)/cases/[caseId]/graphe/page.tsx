import { notFound } from "next/navigation";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeLayout } from "@/lib/graph/layout";
import { serializeGraph } from "@/lib/graph/serialize";
import GraphCanvas from "@/components/graph/GraphCanvas.client";
import { getCasesRepository } from "@/lib/data/cases-repository";

export default async function GrapheTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  // Layout calculé côté serveur (Graphology en Node) → coordonnées prêtes.
  const graph = buildGraph(detail.bundle);
  computeLayout(graph);
  const dto = serializeGraph(graph);

  return (
    <div className="h-full">
      <GraphCanvas dto={dto} bundle={detail.bundle} />
    </div>
  );
}
