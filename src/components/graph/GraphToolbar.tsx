"use client";

import { ZoomIn, ZoomOut, Maximize2, Layers } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGraphStore } from "@/lib/store/graph-store";
import { LAYER_LABELS } from "@/lib/graph/graph-types";
import type { LayerKey } from "@/lib/graph/graph-types";

const LAYERS: LayerKey[] = [
  "gouvernance",
  "capital",
  "adresses",
  "evenements",
  "sanctions",
  "risques",
];

/**
 * Barre d'outils du graphe. Les commandes caméra sont émises via des events
 * custom écoutés par GraphScene (qui a accès à l'instance Sigma).
 */
export default function GraphToolbar() {
  const layers = useGraphStore((s) => s.layers);
  const toggleLayer = useGraphStore((s) => s.toggleLayer);

  const cam = (action: "in" | "out" | "fit") =>
    window.dispatchEvent(new CustomEvent("kyb:graph-camera", { detail: action }));

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground backdrop-blur transition hover:text-foreground";

  return (
    <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => cam("in")} aria-label="Zoom avant">
        <ZoomIn size={16} />
      </button>
      <button type="button" className={btn} onClick={() => cam("out")} aria-label="Zoom arrière">
        <ZoomOut size={16} />
      </button>
      <button type="button" className={btn} onClick={() => cam("fit")} aria-label="Recentrer">
        <Maximize2 size={16} />
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={btn} aria-label="Couches">
            <Layers size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-2">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Couches
          </p>
          <div className="space-y-0.5">
            {LAYERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleLayer(key)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition hover:bg-accent"
              >
                <span
                  className={
                    layers[key]
                      ? "text-foreground"
                      : "text-muted-foreground line-through"
                  }
                >
                  {LAYER_LABELS[key]}
                </span>
                <span
                  className={`h-3.5 w-3.5 rounded border ${
                    layers[key]
                      ? "border-primary bg-primary"
                      : "border-border"
                  }`}
                />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
