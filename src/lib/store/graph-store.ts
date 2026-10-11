import { create } from "zustand";
import type { LayerKey } from "@/lib/graph/graph-types";

export type ViewMode = "graph" | "table";
/** Mode de coloration des nœuds : par niveau de preuve (défaut) ou par communauté. */
export type ColorMode = "proof" | "community";

export type PathHighlight = {
  source: string;
  target: string;
  nodes: string[]; // séquence ordonnée des nœuds du plus court chemin
};

/** Couches par défaut : les événements publiés (souvent des centaines) sont repliés. */
const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  gouvernance: true,
  capital: true,
  adresses: true,
  evenements: false,
  sanctions: true,
  risques: false,
};

type GraphState = {
  layers: Record<LayerKey, boolean>;
  selectedNode: string | null;
  selectedEdge: string | null;
  /** Nœud survolé (ou focalisé au clavier) : infobulle et mise en avant du voisinage. */
  hoveredId: string | null;
  viewMode: ViewMode;
  colorMode: ColorMode;
  /** Origine d'un path-finding en cours (étape 1/2 du UX). */
  pathSource: string | null;
  /** Résultat du dernier path-finding (séquence de nœuds). */
  path: PathHighlight | null;
  /** Recherche d'entité sur la scène. */
  query: string;
  /** Curseur temporel « qui contrôlait quand » : 0 = plus ancienne date, 1 = aujourd'hui. */
  cursor: number;
  /** Sons et retours haptiques discrets (conservés d'un dossier à l'autre). */
  sound: boolean;
  toggleLayer: (key: LayerKey) => void;
  selectNode: (id: string) => void;
  selectEdge: (id: string) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  toggleViewMode: () => void;
  toggleColorMode: () => void;
  setPathSource: (id: string | null) => void;
  setPath: (p: PathHighlight | null) => void;
  clearPath: () => void;
  setQuery: (q: string) => void;
  setCursor: (c: number) => void;
  toggleSound: () => void;
  /** Remise à zéro à l'ouverture d'un autre dossier (sélection, filtres, curseur). */
  reset: () => void;
};

const INITIAL = {
  layers: DEFAULT_LAYERS,
  selectedNode: null,
  selectedEdge: null,
  hoveredId: null,
  viewMode: "graph" as ViewMode,
  colorMode: "proof" as ColorMode,
  pathSource: null,
  path: null,
  query: "",
  cursor: 1,
};

export const useGraphStore = create<GraphState>((set) => ({
  ...INITIAL,
  sound: true,
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  toggleColorMode: () =>
    set((s) => ({ colorMode: s.colorMode === "proof" ? "community" : "proof" })),
  selectNode: (id) => set({ selectedNode: id, selectedEdge: null }),
  selectEdge: (id) => set({ selectedEdge: id, selectedNode: null }),
  clearSelection: () => set({ selectedNode: null, selectedEdge: null }),
  setHovered: (id) => set({ hoveredId: id }),
  setViewMode: (m) => set({ viewMode: m }),
  toggleViewMode: () =>
    set((s) => ({ viewMode: s.viewMode === "graph" ? "table" : "graph" })),
  setPathSource: (id) => set({ pathSource: id }),
  setPath: (p) => set({ path: p }),
  clearPath: () => set({ pathSource: null, path: null }),
  setQuery: (q) => set({ query: q }),
  setCursor: (c) => set({ cursor: c < 0 ? 0 : c > 1 ? 1 : c }),
  toggleSound: () => set((s) => ({ sound: !s.sound })),
  reset: () => set({ ...INITIAL, layers: { ...DEFAULT_LAYERS } }),
}));
