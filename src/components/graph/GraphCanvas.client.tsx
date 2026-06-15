"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import Legend from "./Legend";
import GraphToolbar from "./GraphToolbar";
import GraphTooltip from "./GraphTooltip";
import NodePanel from "./NodePanel";
import EdgePanel from "./EdgePanel";
import GraphTable from "./GraphTable";
import PathBanner from "./PathBanner";
import { useGraphStore } from "@/lib/store/graph-store";

// Moteur SVG sur-mesure (orbes lustrés + flux de particules) — chargé côté
// client uniquement (manipule le DOM, requestAnimationFrame, AudioContext).
const GraphScene = dynamic(() => import("./GraphSceneSvg.client"), {
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
  // Mémoïsé : le moteur SVG reconstruit le graphe quand cette prop change ;
  // sans mémoïsation, chaque survol/clic (re-render via le store) recréerait un
  // nouveau tableau et réinitialiserait le graphe (flicker + perte de caméra).
  const flaggedIds = useMemo(
    () =>
      Array.from(
        new Set(
          bundle.riskSignals
            .map((r) => r.subjectId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    [bundle.riskSignals],
  );
  const viewMode = useGraphStore((s) => s.viewMode);

  return (
    <div
      role="region"
      aria-label={`Graphe des relations du dossier ${bundle.case.title}`}
      className="graph-stage relative h-full w-full overflow-hidden"
    >
      {/* Calques d'ambiance (aurores + grille en fondu + vignette). */}
      <div className="graph-aurora" aria-hidden />
      <div className="graph-grid" aria-hidden />
      <GraphScene dto={dto} flaggedIds={flaggedIds} />
      <div className="graph-vignette" aria-hidden />
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
