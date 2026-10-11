"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { GraphView, Visibility } from "@/lib/graph/graph-view";
import { dateAtFraction } from "@/lib/graph/graph-view";
import { formatDateFr } from "@/lib/format-date";

const TICKS = Array.from({ length: 11 }, (_, i) => i);

/**
 * Curseur temporel « qui contrôlait quand » : la scène, la table et les comptes
 * ne montrent que les liens valides à la date choisie (dates de début / fin des
 * liens). Clavier : flèches (± 1 %), Début / Fin.
 */
export default function TimeCursor({ view, visibility }: { view: GraphView; visibility: Visibility }) {
  const cursor = useGraphStore((s) => s.cursor);
  const setCursor = useGraphStore((s) => s.setCursor);
  const showEvents = useGraphStore((s) => s.layers.evenements);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const { counts } = visibility;
  const summary = `${counts.entities} entité${counts.entities > 1 ? "s" : ""} · ${counts.links} lien${counts.links > 1 ? "s" : ""}${
    showEvents ? ` · ${counts.events} événement${counts.events > 1 ? "s" : ""}` : ""
  }`;
  const bar = "flex flex-none flex-wrap items-center gap-x-[18px] gap-y-2 border-t border-border px-4 py-3 font-mono text-micro text-subtle sm:px-8";

  if (!view.timeStart) {
    return (
      <div className={bar}>
        <span className="text-muted-foreground">Qui contrôlait quand</span>
        <span>Aucun lien daté dans ce dossier : la vue montre l&apos;état connu.</span>
        <span className="text-muted-foreground">{summary}</span>
      </div>
    );
  }

  const start = view.timeStart;
  const at = dateAtFraction(start, view.timeEnd, cursor);
  const label = formatDateFr(at);
  const frac = (e: PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  const onKey = (e: KeyboardEvent) => {
    const d =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? -0.01
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? 0.01
          : e.key === "Home"
            ? -1
            : e.key === "End"
              ? 1
              : 0;
    if (!d) return;
    e.preventDefault();
    setCursor(cursor + d);
  };
  const pct = `${(cursor * 100).toFixed(2)}%`;

  return (
    <div className={bar}>
      <span className="flex-none text-muted-foreground">Qui contrôlait quand</span>
      <span className="flex-none">{start.slice(0, 4)}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Curseur temporel"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(cursor * 100)}
        aria-valuetext={label}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointeur synthétique */
          }
          dragging.current = true;
          setCursor(frac(e));
        }}
        onPointerMove={(e) => {
          if (dragging.current) setCursor(frac(e));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={onKey}
        className="relative h-[22px] min-w-[180px] flex-[1_1_220px] cursor-ew-resize touch-none rounded-sm"
      >
        <div aria-hidden className="absolute inset-x-0 top-1.5 flex h-[9px] justify-between border-b border-border-strong">
          {TICKS.map((i) => (
            <span key={i} className="h-full w-px bg-border-strong" />
          ))}
        </div>
        <div aria-hidden className="absolute left-0 top-3.5 h-0.5 bg-foreground" style={{ width: pct }} />
        <div
          aria-hidden
          className="absolute top-2.5 size-[9px] -translate-x-1/2 rounded-full bg-primary ring-[3px] ring-background"
          style={{ left: pct }}
        />
      </div>
      <span className="flex-none">{view.timeEnd.slice(0, 4)}</span>
      <span className="flex-none text-primary">au {label}</span>
      <span className="flex-none text-muted-foreground">{summary}</span>
      {cursor < 0.999 ? (
        <button
          type="button"
          onClick={() => setCursor(1)}
          className="flex-none text-muted-foreground underline underline-offset-[3px] transition-ui hover:text-primary"
        >
          Aujourd&apos;hui
        </button>
      ) : null}
    </div>
  );
}
