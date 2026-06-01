"use client";

import { useEffect, useMemo } from "react";
import Graph from "graphology";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import type { GraphDTO, LayerKey } from "@/lib/graph/graph-types";
import { layerForEdgeType, layerForNodeKind } from "@/lib/graph/graph-types";
import { useGraphStore } from "@/lib/store/graph-store";

type NodeMeta = { layer: LayerKey | null };
type EdgeMeta = {
  layer: LayerKey | null;
  srcLayer: LayerKey | null;
  tgtLayer: LayerKey | null;
};

function Controllers({
  dto,
  flaggedIds,
}: {
  dto: GraphDTO;
  flaggedIds: string[];
}) {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings();
  const sigma = useSigma();
  const layers = useGraphStore((s) => s.layers);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectedEdge = useGraphStore((s) => s.selectedEdge);

  const flagged = useMemo(() => new Set(flaggedIds), [flaggedIds]);

  const { nodeMeta, edgeMeta } = useMemo(() => {
    const kindById = new Map(dto.nodes.map((n) => [n.id, n.kind]));
    const nm = new Map<string, NodeMeta>();
    for (const n of dto.nodes) nm.set(n.id, { layer: layerForNodeKind(n.kind) });
    const em = new Map<string, EdgeMeta>();
    for (const e of dto.edges) {
      em.set(e.id, {
        layer: layerForEdgeType(e.type),
        srcLayer: layerForNodeKind(kindById.get(e.source) ?? ""),
        tgtLayer: layerForNodeKind(kindById.get(e.target) ?? ""),
      });
    }
    return { nodeMeta: nm, edgeMeta: em };
  }, [dto]);

  // Charge le graphe une fois (coordonnées déjà calculées côté serveur).
  useEffect(() => {
    const g = new Graph({ type: "directed", multi: true });
    for (const n of dto.nodes) {
      g.addNode(n.id, {
        x: n.x,
        y: n.y,
        size: n.size,
        label: n.label,
        color: n.color,
      });
    }
    for (const e of dto.edges) {
      if (g.hasNode(e.source) && g.hasNode(e.target) && !g.hasEdge(e.id)) {
        g.addEdgeWithKey(e.id, e.source, e.target, {
          size: 2,
          color: e.color,
          label: e.label,
        });
      }
    }
    loadGraph(g);
  }, [loadGraph, dto]);

  // Clic sur nœud / lien / fond → store.
  useEffect(() => {
    registerEvents({
      clickNode: (e) => useGraphStore.getState().selectNode(e.node),
      clickEdge: (e) => useGraphStore.getState().selectEdge(e.edge),
      clickStage: () => useGraphStore.getState().clearSelection(),
    });
  }, [registerEvents]);

  // Commandes caméra émises par GraphToolbar (zoom / recentrer).
  useEffect(() => {
    const onCamera = (e: Event) => {
      const action = (e as CustomEvent<"in" | "out" | "fit">).detail;
      const camera = sigma.getCamera();
      if (action === "in") camera.animatedZoom({ duration: 250 });
      else if (action === "out") camera.animatedUnzoom({ duration: 250 });
      else camera.animatedReset({ duration: 350 });
    };
    window.addEventListener("kyb:graph-camera", onCamera);
    return () => window.removeEventListener("kyb:graph-camera", onCamera);
  }, [sigma]);

  // Filtres par couche + surbrillance (reducers, sans muter le graphe).
  useEffect(() => {
    setSettings({
      nodeReducer: (node, data) => {
        const res = { ...data };
        const meta = nodeMeta.get(node);
        if (meta?.layer && !layers[meta.layer]) res.hidden = true;
        if (layers.risques && flagged.has(node)) {
          res.size = (data.size ?? 8) * 1.6;
          res.color = "#ef4444";
          res.forceLabel = true;
        }
        if (selectedNode === node) {
          res.highlighted = true;
          res.forceLabel = true;
          res.zIndex = 10;
        }
        return res;
      },
      edgeReducer: (edge, data) => {
        const res = { ...data };
        const meta = edgeMeta.get(edge);
        if (meta) {
          if (meta.layer && !layers[meta.layer]) res.hidden = true;
          if (meta.srcLayer && !layers[meta.srcLayer]) res.hidden = true;
          if (meta.tgtLayer && !layers[meta.tgtLayer]) res.hidden = true;
        }
        if (selectedEdge === edge) {
          res.color = "#ffffff";
          res.size = 4;
        }
        return res;
      },
    });
  }, [setSettings, layers, selectedNode, selectedEdge, flagged, nodeMeta, edgeMeta]);

  return null;
}

export default function GraphScene({
  dto,
  flaggedIds,
}: {
  dto: GraphDTO;
  flaggedIds: string[];
}) {
  return (
    <SigmaContainer
      style={{ height: "100%", width: "100%", background: "transparent" }}
      settings={{
        allowInvalidContainer: true,
        defaultEdgeType: "arrow",
        renderEdgeLabels: false,
        labelColor: { color: "#e8eef7" },
        labelSize: 12,
        labelFont: "Inter, sans-serif",
        zIndex: true,
      }}
    >
      <Controllers dto={dto} flaggedIds={flaggedIds} />
    </SigmaContainer>
  );
}
