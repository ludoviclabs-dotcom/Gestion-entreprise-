import { create } from "zustand";
import type { LayerKey } from "@/lib/graph/graph-types";

export type HoveredItem = {
  id: string;
  kind: "node" | "edge";
  x: number;
  y: number;
};

type GraphState = {
  layers: Record<LayerKey, boolean>;
  selectedNode: string | null;
  selectedEdge: string | null;
  hovered: HoveredItem | null;
  toggleLayer: (key: LayerKey) => void;
  selectNode: (id: string) => void;
  selectEdge: (id: string) => void;
  clearSelection: () => void;
  setHovered: (h: HoveredItem | null) => void;
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
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  selectNode: (id) => set({ selectedNode: id, selectedEdge: null }),
  selectEdge: (id) => set({ selectedEdge: id, selectedNode: null }),
  clearSelection: () => set({ selectedNode: null, selectedEdge: null }),
  setHovered: (h) => set({ hovered: h }),
}));
