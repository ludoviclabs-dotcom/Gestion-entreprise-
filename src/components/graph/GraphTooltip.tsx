"use client";

import { useGraphStore } from "@/lib/store/graph-store";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import {
  NODE_COLORS,
  NODE_LABELS,
  EDGE_LABELS,
  isHypothesis,
} from "@/lib/graph/graph-types";
import EvidenceBadge from "./EvidenceBadge";

/**
 * Tooltip flottant qui apparaît au survol d'un nœud ou d'un lien.
 * Position en pixels viewport, fournie par GraphScene via le store
 * (sigma.graphToViewport).
 */
export default function GraphTooltip({
  dto,
  bundle,
}: {
  dto: GraphDTO;
  bundle: CaseBundle;
}) {
  const hovered = useGraphStore((s) => s.hovered);
  if (!hovered) return null;

  let title = "";
  let kindLabel = "";
  let color = "#7c3aed";
  let evidence: import("@/lib/graph/graph-types").EvidenceLevel = "declared";
  let source: string | undefined;

  if (hovered.kind === "node") {
    const node = dto.nodes.find((n) => n.id === hovered.id);
    if (!node) return null;
    title = node.label;
    kindLabel = NODE_LABELS[node.kind];
    color = NODE_COLORS[node.kind];
    evidence = node.evidenceLevel;
    const entity = bundle.entities.find((e) => e.id === hovered.id);
    const event = bundle.events.find((e) => e.id === hovered.id);
    source = entity?.source ?? event?.source;
  } else {
    const edge = dto.edges.find((e) => e.id === hovered.id);
    if (!edge) return null;
    const bundleEdge = bundle.edges.find((e) => e.id === hovered.id);
    const src = dto.nodes.find((n) => n.id === edge.source);
    const tgt = dto.nodes.find((n) => n.id === edge.target);
    title = `${src?.label ?? edge.source} → ${tgt?.label ?? edge.target}`;
    kindLabel = EDGE_LABELS[edge.type];
    evidence = edge.evidenceLevel;
    source = bundleEdge?.excerpt;
  }

  // Offset léger pour ne pas masquer le curseur.
  const style: React.CSSProperties = {
    left: hovered.x + 16,
    top: hovered.y - 8,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-30 max-w-xs rounded-lg border border-border bg-surface/95 p-3 shadow-lg backdrop-blur"
      style={style}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {kindLabel}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium leading-snug">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EvidenceBadge level={evidence} />
        {isHypothesis(evidence) && (
          <span className="text-[10px] text-amber">à vérifier</span>
        )}
      </div>
      {source && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">Source : </span>
          {source}
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground/70">
        Cliquez l&apos;élément pour la fiche de preuve complète.
      </p>
    </div>
  );
}
