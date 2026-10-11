"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Boxes,
  ImageDown,
  Layers,
  Maximize2,
  Network,
  Table as TableIcon,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGraphStore } from "@/lib/store/graph-store";
import { LAYER_LABELS } from "@/lib/graph/graph-types";
import type { LayerKey } from "@/lib/graph/graph-types";

const LAYERS: LayerKey[] = ["gouvernance", "capital", "adresses", "evenements", "sanctions", "risques"];

const camera = (detail: "in" | "out" | "fit") =>
  window.dispatchEvent(new CustomEvent("kyb:graph-camera", { detail }));

function Tool({
  label,
  icon: Icon,
  on,
  onClick,
  pressed,
  expanded,
  controls,
}: {
  label: string;
  icon: LucideIcon;
  on?: boolean;
  onClick: () => void;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm border bg-background transition-ui",
        on
          ? "border-primary text-primary"
          : "border-border text-muted-foreground hover:border-control hover:text-foreground",
      )}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}

/**
 * Outils de la scène : caméra, export PNG, sons, bascule table / graphe,
 * coloration par communauté et menu des couches. Les commandes caméra et
 * l'export sont des événements écoutés par la scène SVG.
 */
export default function GraphToolbar({ counts }: { counts: Partial<Record<LayerKey, number>> }) {
  const layers = useGraphStore((s) => s.layers);
  const toggleLayer = useGraphStore((s) => s.toggleLayer);
  const viewMode = useGraphStore((s) => s.viewMode);
  const toggleViewMode = useGraphStore((s) => s.toggleViewMode);
  const colorMode = useGraphStore((s) => s.colorMode);
  const toggleColorMode = useGraphStore((s) => s.toggleColorMode);
  const sound = useGraphStore((s) => s.sound);
  const toggleSound = useGraphStore((s) => s.toggleSound);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  // Le menu des couches se referme au clic extérieur et sur Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="absolute right-4 top-4 z-[var(--z-sticky)] sm:right-8 sm:top-5">
      <div className="flex gap-1.5">
        <Tool label="Zoom avant" icon={ZoomIn} onClick={() => camera("in")} />
        <Tool label="Zoom arrière" icon={ZoomOut} onClick={() => camera("out")} />
        <Tool label="Recentrer" icon={Maximize2} onClick={() => camera("fit")} />
        <Tool
          label="Exporter en PNG"
          icon={ImageDown}
          onClick={() => window.dispatchEvent(new CustomEvent("kyb:graph-export-png"))}
        />
        <Tool
          label={sound ? "Couper les sons" : "Activer les sons"}
          icon={sound ? Volume2 : VolumeX}
          on={sound}
          pressed={sound}
          onClick={toggleSound}
        />
        <Tool
          label={viewMode === "graph" ? "Voir en table (T)" : "Voir le graphe (T)"}
          icon={viewMode === "graph" ? TableIcon : Network}
          on={viewMode === "table"}
          pressed={viewMode === "table"}
          onClick={toggleViewMode}
        />
        <Tool
          label="Colorer par communauté structurelle"
          icon={Boxes}
          on={colorMode === "community"}
          pressed={colorMode === "community"}
          onClick={toggleColorMode}
        />
        <Tool
          label="Couches"
          icon={Layers}
          on={open}
          expanded={open}
          controls={menuId}
          onClick={() => setOpen((v) => !v)}
        />
      </div>

      {open ? (
        <div
          id={menuId}
          role="group"
          aria-label="Couches"
          className="motion-reveal absolute right-0 top-10 min-w-[232px] rounded-sm bg-surface-3 py-2 font-mono text-xs shadow-lg"
        >
          <div className="px-3.5 pb-2 pt-1.5 text-micro uppercase tracking-[0.1em] text-subtle">Couches</div>
          {LAYERS.map((key) => {
            const on = layers[key];
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLayer(key)}
                className="flex w-full items-center justify-between gap-4 px-3.5 py-2 text-left text-foreground transition-ui hover:bg-surface-2"
              >
                <span className="flex items-baseline gap-2">
                  <span className={on ? undefined : "text-subtle line-through"}>{LAYER_LABELS[key]}</span>
                  {count !== undefined ? <span className="text-micro text-subtle">({count})</span> : null}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "inline-block size-3 rounded-[2px] border",
                    on ? "border-primary bg-primary" : "border-control bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
