"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { Network } from "lucide-react";
import EmptyState from "@/components/empty/EmptyState";
import type { CaseBundle, GraphDTO, LayerKey } from "@/lib/graph/graph-types";
import { maxSeverityBySubject } from "@/lib/graph/graph-types";
import { buildGraphView, computeVisibility, dateAtFraction } from "@/lib/graph/graph-view";
import { useGraphStore } from "@/lib/store/graph-store";
import GraphToolbar from "./GraphToolbar";
import GraphSearch, { GRAPH_SEARCH_ID } from "./GraphSearch";
import GraphFiche from "./GraphFiche";
import GraphTable from "./GraphTable";
import Legend from "./Legend";
import PathBanner from "./PathBanner";
import TimeCursor from "./TimeCursor";

// Scène SVG pilotée impérativement (DOM, requestAnimationFrame, AudioContext) :
// rendue côté client uniquement.
const GraphScene = dynamic(() => import("./GraphSceneSvg.client"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center font-mono text-xs text-subtle">
      Chargement du graphe…
    </div>
  ),
});

/**
 * Onglet Graphe du dossier (refonte « Registre / Nuit ») : scène, recherche,
 * outils, couches, légende, fiche latérale, vue table et curseur temporel.
 * L'en-tête du dossier et les onglets vivent dans le layout du workspace.
 */
export default function GraphCanvas({
  dto,
  bundle,
  today,
}: {
  dto: GraphDTO;
  bundle: CaseBundle;
  /** Date du jour (AAAA-MM-JJ), fixée côté serveur pour un rendu déterministe. */
  today: string;
}) {
  const caseId = bundle.case.id;
  const view = useMemo(() => buildGraphView(dto, bundle, today), [dto, bundle, today]);
  // Mémoïsé : la scène se reconstruit quand cette prop change.
  const flaggedSeverity = useMemo(
    () => Object.fromEntries(maxSeverityBySubject(bundle.riskSignals)),
    [bundle.riskSignals],
  );

  const layers = useGraphStore((s) => s.layers);
  const cursor = useGraphStore((s) => s.cursor);
  const viewMode = useGraphStore((s) => s.viewMode);
  const at = view.timeStart ? dateAtFraction(view.timeStart, view.timeEnd, cursor) : null;
  const visibility = useMemo(() => computeVisibility(view, layers, at), [view, layers, at]);

  const clusters = useMemo(
    () =>
      [...new Set(view.nodes.filter((n) => n.kind !== "event" || layers.evenements).map((n) => n.cluster))].sort(
        (a, b) => a - b,
      ),
    [view, layers.evenements],
  );
  const layerCounts: Partial<Record<LayerKey, number>> = {
    evenements: view.nodes.filter((n) => n.kind === "event").length,
    risques: bundle.riskSignals.length,
  };

  // Nouveau dossier : sélection, filtres, recherche et curseur repartent de zéro.
  useEffect(() => {
    useGraphStore.getState().reset();
  }, [caseId]);

  // Raccourcis : T = table / graphe, / = recherche, Échap = fermer la fiche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGraphStore.getState();
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        st.toggleViewMode();
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById(GRAPH_SEARCH_ID)?.focus();
      } else if (e.key === "Escape" && (st.selectedNode || st.selectedEdge)) {
        st.clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (view.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center px-8">
        <EmptyState
          icon={Network}
          title="Graphe indisponible"
          description="Aucune entité n'a pu être placée pour ce dossier. Les autres onglets restent consultables."
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[420px] flex-col">
      <div
        role="region"
        aria-label={`Graphe des relations du dossier ${bundle.case.title}`}
        className="relative min-h-[372px] flex-1 overflow-hidden"
      >
        <GraphScene view={view} flaggedSeverity={flaggedSeverity} exportName={`graphe-${caseId}`} />
        <GraphSearch view={view} visibility={visibility} />
        <GraphToolbar counts={layerCounts} />
        {viewMode === "graph" ? <Legend clusters={clusters} /> : null}
        {viewMode === "graph" ? <PathBanner view={view} /> : null}
        <GraphFiche view={view} caseId={caseId} signals={bundle.riskSignals} />
        {viewMode === "table" ? <GraphTable view={view} visibility={visibility} /> : null}
      </div>
      <TimeCursor view={view} visibility={visibility} />
    </div>
  );
}
