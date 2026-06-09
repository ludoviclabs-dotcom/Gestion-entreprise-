"use client";

import { useState } from "react";
import { useReducedMotion } from "../useReducedMotion";
import {
  EDGE_STROKE,
  GRAPH_VIEWBOX,
  MOCK_EDGES,
  MOCK_NODES,
  NODE_FILL,
  NODE_TYPE_LABEL,
  edgeEndpoints,
  findNode,
  labelAnchor,
} from "./graph-data";

/**
 * Mini-graphe data-driven (viewBox 640×420), rendu en 3 couches :
 *   1. arêtes (derrière) — ancrées au BORD des cercles via edgeEndpoints()
 *   2. nœuds — cliquables + focusables clavier (role=button, Enter/Space)
 *   3. libellés (au-dessus) — placés par labelPosition, halo paint-order
 * Les arêtes « pointillées » (risque / correspondance) s'animent, neutralisé
 * sous prefers-reduced-motion. L'anneau de focus est dessiné DANS le SVG (le
 * conteneur arrondi `overflow-hidden` clipperait un outline CSS).
 */
export default function MockupGraph({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const isActive = (id: string) => hover === id || selected === id;

  return (
    <svg
      viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="group"
      aria-label="Graphe relationnel de démonstration"
    >
      {/* Couche 1 — arêtes */}
      <g>
        {MOCK_EDGES.map((edge) => {
          const a = findNode(edge.source);
          const b = findNode(edge.target);
          if (!a || !b) return null;
          const { x1, y1, x2, y2 } = edgeEndpoints(a, b);
          const active = isActive(edge.source) || isActive(edge.target);
          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={EDGE_STROKE[edge.type ?? "ownership"]}
              strokeWidth={active ? 2.4 : 1.6}
              strokeDasharray={edge.dashed ? "5 5" : undefined}
              strokeLinecap="round"
              style={{ transition: "stroke-width .2s" }}
            >
              {edge.dashed && !reduce && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="10"
                  to="0"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              )}
            </line>
          );
        })}
      </g>

      {/* Couche 2 — nœuds */}
      <g>
        {MOCK_NODES.map((n) => {
          const active = isActive(n.id);
          const sel = selected === n.id;
          const fill = NODE_FILL[n.type];
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={`${n.label} — ${NODE_TYPE_LABEL[n.type]}`}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(n.id);
                }
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {(n.main || sel) && !reduce && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.radius + 4}
                  fill="none"
                  stroke={sel ? "var(--kyb-green)" : "var(--kyb-violet)"}
                  strokeWidth="1.5"
                  opacity="0.5"
                >
                  <animate attributeName="r" from={String(n.radius + 2)} to={String(n.radius + 12)} dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              {(active || sel) && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.radius + 3}
                  fill="none"
                  stroke={sel ? "var(--kyb-green)" : "var(--kyb-violet-soft)"}
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.radius}
                fill={fill}
                style={{
                  transition: "r .2s",
                  filter: active ? `drop-shadow(0 0 6px ${fill})` : "none",
                }}
              />
            </g>
          );
        })}
      </g>

      {/* Couche 3 — libellés */}
      <g style={{ pointerEvents: "none" }}>
        {MOCK_NODES.map((n) => {
          const active = isActive(n.id);
          const { x, y, textAnchor, dominantBaseline } = labelAnchor(n);
          return (
            <text
              key={n.id}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline={dominantBaseline}
              fontSize={n.main ? 14 : 12.5}
              fontWeight={n.main ? 700 : 500}
              fill={active ? "var(--kyb-text-hi)" : "var(--kyb-text-mid)"}
              style={{
                paintOrder: "stroke",
                stroke: "var(--kyb-bg1)",
                strokeWidth: 3.5,
                strokeLinejoin: "round",
                transition: "fill .2s",
              }}
            >
              {n.label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
