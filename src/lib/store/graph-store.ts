import { create } from "zustand";
import type { LayerKey } from "@/lib/graph/graph-types";

export type HoveredItem = {
  id: string;
  kind: "node" | "edge";
  x: number;
  y: number;
};

export type ViewMode = "graph" | "table";
/** Mode de coloration des nœuds : par type d'entité (défaut) ou par communauté. */
export type ColorMode = "kind" | "community";

export type PathHighlight = {
  source: string;
  target: string;
  nodes: string[]; // séquence ordonnée des nœuds du plus court chemin
};

type GraphState = {
  layers: Record<LayerKey, boolean>;
  selectedNode: string | null;
  selectedEdge: string | null;
  hovered: HoveredItem | null;
  viewMode: ViewMode;
  /** Coloration des nœuds : par type (défaut) ou par communauté structurelle. */
  colorMode: ColorMode;
  /** Origine d'un path-finding en cours (étape 1/2 du UX). */
  pathSource: string | null;
  /** Résultat du dernier path-finding (séquence de nœuds). */
  path: PathHighlight | null;
  toggleLayer: (key: LayerKey) => void;
  selectNode: (id: string) => void;
  selectEdge: (id: string) => void;
  clearSelection: () => void;
  setHovered: (h: HoveredItem | null) => void;
  setViewMode: (m: ViewMode) => void;
  toggleViewMode: () => void;
  setColorMode: (m: ColorMode) => void;
  toggleColorMode: () => void;
  setPathSource: (id: string | null) => void;
  setPath: (p: PathHighlight | null) => void;
  clearPath: () => void;
};

export const useGraphStore = create<GraphState>((set) => ({
  layers: {
    gouvernance: true,
    capital: true,
    adresses: true,
    evenements: true,
    sanctions: true,
    risques: false,
  },
  selectedNode: null,
  selectedEdge: null,
  hovered: null,
  viewMode: "graph",
  colorMode: "kind",
  pathSource: null,
  path: null,
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setColorMode: (m) => set({ colorMode: m }),
  toggleColorMode: () =>
    set((s) => ({ colorMode: s.colorMode === "kind" ? "community" : "kind" })),
  selectNode: (id) => set({ selectedNode: id, selectedEdge: null }),
  selectEdge: (id) => set({ selectedEdge: id, selectedNode: null }),
  clearSelection: () => set({ selectedNode: null, selectedEdge: null }),
  setHovered: (h) => set({ hovered: h }),
  setViewMode: (m) => set({ viewMode: m }),
  toggleViewMode: () =>
    set((s) => ({ viewMode: s.viewMode === "graph" ? "table" : "graph" })),
  setPathSource: (id) => set({ pathSource: id }),
  setPath: (p) => set({ path: p }),
  clearPath: () => set({ pathSource: null, path: null }),
}));
