"use client";

import { useEffect, useRef, useState } from "react";
import {
  EVIDENCE_EDGE_COLORS,
  EVIDENCE_EDGE_OPACITY,
  EVIDENCE_EDGE_SIZE,
  NODE_COLORS,
} from "@/lib/graph/graph-types";
import {
  DEMO_EDGES,
  DEMO_NODES,
  SUSPECT_EDGE_ID,
  type DemoNode,
} from "./demo-data";

/** L'arête s'arrête au bord du cercle (cf. mockup/graph-data.edgeEndpoints). */
const EDGE_PAD = 3;

/**
 * Graphe animé de la démo, en deux couches partageant le même repère
 * fractionnel :
 *   1. arêtes — SVG dimensionné en px (ResizeObserver) pour un tracé
 *      stroke-dashoffset et des pointillés uniformes ;
 *   2. nœuds + libellés — <div> positionnés en %, ce qui rend animables les
 *      effets du brief (spring `transform`, anneaux `box-shadow`) impossibles
 *      sur le canvas WebGL du vrai graphe.
 * Couleurs identiques au vrai graphe (NODE_COLORS / EVIDENCE_EDGE_*).
 * Couche purement décorative : `aria-hidden`, le récit accessible passe par
 * les cartes d'alerte (`role="alert"`).
 */
export default function DemoGraph({
  visibleCount,
  ringNodes,
  suspectActive,
}: {
  /** Nombre de nœuds révélés (ordre de DEMO_NODES). */
  visibleCount: number;
  /** id de nœud → couleur d'anneau pulsé actif. */
  ringNodes: Record<string, string>;
  /** Allume le flux orange sur l'arête HOLDING → « MARTIN HOLDING LTD ». */
  suspectActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const nodes = DEMO_NODES.slice(0, visibleCount);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = DEMO_EDGES.filter((e) => e.appearIndex <= visibleCount);

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden>
      {size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="absolute inset-0"
        >
          {edges.map((edge) => {
            const a = byId.get(edge.source);
            const b = byId.get(edge.target);
            if (!a || !b) return null;

            const ax = a.fx * size.w;
            const ay = a.fy * size.h;
            const bx = b.fx * size.w;
            const by = b.fy * size.h;
            const angle = Math.atan2(by - ay, bx - ax);
            const x1 = ax + Math.cos(angle) * (a.r + EDGE_PAD);
            const y1 = ay + Math.sin(angle) * (a.r + EDGE_PAD);
            const x2 = bx - Math.cos(angle) * (b.r + EDGE_PAD);
            const y2 = by - Math.sin(angle) * (b.r + EDGE_PAD);
            const len = Math.max(Math.hypot(x2 - x1, y2 - y1), 1);

            const suspect = suspectActive && edge.id === SUSPECT_EDGE_ID;
            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeLinecap="round"
                stroke={suspect ? "var(--kyb-orange)" : EVIDENCE_EDGE_COLORS[edge.evidence]}
                strokeWidth={suspect ? 2.5 : EVIDENCE_EDGE_SIZE[edge.evidence]}
                strokeOpacity={suspect ? 1 : EVIDENCE_EDGE_OPACITY[edge.evidence]}
                strokeDasharray={suspect ? "8 4" : edge.dashed ? "6 5" : len}
                className={
                  suspect
                    ? "demo-edge-suspect"
                    : edge.dashed
                      ? "demo-edge-fade"
                      : "demo-edge-enter"
                }
                style={
                  suspect || edge.dashed
                    ? undefined
                    : ({ "--len": String(len) } as React.CSSProperties)
                }
              />
            );
          })}
        </svg>
      )}
      {nodes.map((node) => (
        <DemoGraphNode key={node.id} node={node} ringColor={ringNodes[node.id]} />
      ))}
    </div>
  );
}

function DemoGraphNode({
  node,
  ringColor,
}: {
  node: DemoNode;
  ringColor?: string;
}) {
  return (
    <div
      className={`demo-node ${ringColor ? "demo-alert-ring" : "demo-node-enter"}`}
      style={{
        left: `${node.fx * 100}%`,
        top: `${node.fy * 100}%`,
        width: node.r * 2,
        height: node.r * 2,
        marginLeft: -node.r,
        marginTop: -node.r,
        backgroundColor: NODE_COLORS[node.kind],
        ...(node.main ? { border: "2px solid rgba(255,255,255,0.75)" } : null),
        ...(ringColor
          ? ({ "--alert-color": ringColor } as React.CSSProperties)
          : null),
      }}
    >
      <span
        className={`demo-node-label demo-node-label--${node.labelPos}${
          node.main ? " demo-node-label--main" : ""
        }`}
      >
        {node.label}
      </span>
    </div>
  );
}
