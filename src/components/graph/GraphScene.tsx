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
import { downloadAsImage } from "@sigma/export-image";
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
  const path = useGraphStore((s) => s.path);

  const flagged = useMemo(() => new Set(flaggedIds), [flaggedIds]);

  /** Edges sur la séquence du plus court chemin (à mettre en évidence). */
  const pathSet = useMemo(() => {
    const result = { nodes: new Set<string>(), edges: new Set<string>() };
    if (!path || path.nodes.length < 2) return result;
    for (const n of path.nodes) result.nodes.add(n);
    const graph = sigma.getGraph();
    for (let i = 0; i < path.nodes.length - 1; i += 1) {
      const a = path.nodes[i];
      const b = path.nodes[i + 1];
      if (!graph.hasNode(a) || !graph.hasNode(b)) continue;
      const candidates = [
        ...graph.outEdges(a).filter((e) => graph.target(e) === b),
        ...graph.outEdges(b).filter((e) => graph.target(e) === a),
      ];
      for (const e of candidates) result.edges.add(e);
    }
    return result;
  }, [path, sigma]);

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
          // Taille = encodage du niveau de preuve (a11y : double encodage
          // couleur + taille pour les utilisateurs daltoniens).
          size: e.size,
          color: e.color,
          label: e.label,
          evidenceLevel: e.evidenceLevel,
        });
      }
    }
    loadGraph(g);
  }, [loadGraph, dto]);

  // Clic sur nœud / lien / fond + survol pour tooltip → store.
  useEffect(() => {
    registerEvents({
      clickNode: (e) => useGraphStore.getState().selectNode(e.node),
      clickEdge: (e) => useGraphStore.getState().selectEdge(e.edge),
      clickStage: () => useGraphStore.getState().clearSelection(),
      enterNode: (e) => {
        const attrs = sigma.getGraph().getNodeAttributes(e.node);
        const view = sigma.graphToViewport({
          x: Number(attrs.x ?? 0),
          y: Number(attrs.y ?? 0),
        });
        useGraphStore
          .getState()
          .setHovered({ id: e.node, kind: "node", x: view.x, y: view.y });
      },
      leaveNode: () => useGraphStore.getState().setHovered(null),
      enterEdge: (e) => {
        const graph = sigma.getGraph();
        const [src, tgt] = graph.extremities(e.edge);
        const a = graph.getNodeAttributes(src);
        const b = graph.getNodeAttributes(tgt);
        const view = sigma.graphToViewport({
          x: (Number(a.x ?? 0) + Number(b.x ?? 0)) / 2,
          y: (Number(a.y ?? 0) + Number(b.y ?? 0)) / 2,
        });
        useGraphStore
          .getState()
          .setHovered({ id: e.edge, kind: "edge", x: view.x, y: view.y });
      },
      leaveEdge: () => useGraphStore.getState().setHovered(null),
    });
  }, [registerEvents, sigma]);

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

  // Export PNG via @sigma/export-image : le paquet recrée un renderer
  // temporaire avec `preserveDrawingBuffer`, ce qui garantit que les calques
  // WebGL (nœuds + arêtes) sont capturés. L'ancienne composition manuelle de
  // `sigma.getCanvases()` ne ressortait que le calque 2D des libellés (le
  // drawing buffer WebGL se relit vide sans preserveDrawingBuffer). Émis par
  // GraphToolbar.
  useEffect(() => {
    const onExport = () => {
      void downloadAsImage(sigma, {
        format: "png",
        // L'extension .png est ajoutée par le paquet à partir de `format`.
        fileName: `graphe-${new Date().toISOString().slice(0, 10)}`,
        backgroundColor: "#0A1628", // fond navy = identité du graphe
      });
    };
    window.addEventListener("kyb:graph-export-png", onExport);
    return () => window.removeEventListener("kyb:graph-export-png", onExport);
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
        // Path-finding : nœuds du chemin → halo violet + label forcé.
        if (path) {
          if (pathSet.nodes.has(node)) {
            res.color = "#7c3aed";
            res.size = (data.size ?? 8) * 1.4;
            res.forceLabel = true;
            res.zIndex = 11;
            res.hidden = false; // priorité sur les filtres de couche
          } else {
            res.color = data.color;
            res.size = (data.size ?? 8) * 0.55;
            res.hidden = true;
          }
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
        // Path-finding : edges du chemin → trait épais violet, le reste atténué.
        if (path) {
          if (pathSet.edges.has(edge)) {
            res.color = "#7c3aed";
            res.size = 5;
            res.zIndex = 11;
            res.hidden = false;
          } else {
            res.hidden = true;
          }
        }
        return res;
      },
    });
  }, [
    setSettings,
    layers,
    selectedNode,
    selectedEdge,
    flagged,
    nodeMeta,
    edgeMeta,
    path,
    pathSet,
  ]);

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
