"use client";

import dynamic from "next/dynamic";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import Legend from "./Legend";
import GraphToolbar from "./GraphToolbar";
import GraphTooltip from "./GraphTooltip";
import NodePanel from "./NodePanel";
import EdgePanel from "./EdgePanel";
import GraphTable from "./GraphTable";
import PathBanner from "./PathBanner";
import { useGraphStore } from "@/lib/store/graph-store";

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
  const viewMode = useGraphStore((s) => s.viewMode);

  return (
    <div
      role="region"
      aria-label={`Graphe des relations du dossier ${bundle.case.title}`}
      className="bg-grid relative h-full w-full overflow-hidden"
    >
      <GraphScene dto={dto} flaggedIds={flaggedIds} />
      {viewMode === "table" && <GraphTable bundle={bundle} />}
      <GraphToolbar />
      {viewMode === "graph" && <PathBanner bundle={bundle} />}
      {viewMode === "graph" && <Legend />}
      {viewMode === "graph" && <GraphTooltip dto={dto} bundle={bundle} />}
      <NodePanel dto={dto} bundle={bundle} />
      <EdgePanel dto={dto} bundle={bundle} />
    </div>
  );
}
