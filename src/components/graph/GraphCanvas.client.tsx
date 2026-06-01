"use client";

import dynamic from "next/dynamic";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import Legend from "./Legend";
import GraphToolbar from "./GraphToolbar";
import GraphTooltip from "./GraphTooltip";
import NodePanel from "./NodePanel";
import EdgePanel from "./EdgePanel";

// Sigma est WebGL → chargé uniquement côté client (jamais de SSR).
const GraphScene = dynamic(() => import("./GraphScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted-foreground)]">
      Chargement du graphe…
    </div>
  ),
});

/**
 * Canvas du graphe pour le workspace : remplit son conteneur parent (h-full).
 * L'en-tête du dossier vit dans le layout du workspace ; ici on garde la
 * toolbar (zoom/couches/export), la légende, les panneaux d'inspection
 * (node/edge) et la tooltip de survol.
 */
export default function GraphCanvas({
  dto,
  bundle,
}: {
  dto: GraphDTO;
  bundle: CaseBundle;
}) {
  const flaggedIds = Array.from(
    new Set(
      bundle.riskSignals
        .map((r) => r.subjectId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  return (
    <div
      role="img"
      aria-label={`Graphe des relations du dossier ${bundle.case.title}`}
      className="bg-grid relative h-full w-full overflow-hidden"
    >
      <GraphScene dto={dto} flaggedIds={flaggedIds} />
      <GraphToolbar />
      <Legend />
      <GraphTooltip dto={dto} bundle={bundle} />
      <NodePanel dto={dto} bundle={bundle} />
      <EdgePanel dto={dto} bundle={bundle} />
    </div>
  );
}
