"use client";

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

export default function LayerFilters() {
  const layers = useGraphStore((s) => s.layers);
  const toggleLayer = useGraphStore((s) => s.toggleLayer);

  return (
    <div className="absolute left-4 top-20 z-20 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 backdrop-blur">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Couches
      </p>
      <div className="space-y-1">
        {LAYERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-[var(--surface-2)]"
          >
            <span
              className={
                layers[key]
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] line-through"
              }
            >
              {LAYER_LABELS[key]}
            </span>
            <span
              className={`h-3.5 w-3.5 rounded border ${
                layers[key]
                  ? "border-[var(--violet)] bg-[var(--violet)]"
                  : "border-[var(--border)]"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
