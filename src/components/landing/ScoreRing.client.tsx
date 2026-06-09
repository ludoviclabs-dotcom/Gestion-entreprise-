"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";
import CountUp from "./CountUp.client";

/**
 * Anneau de score animé (stroke-dashoffset). La couleur dépend du niveau
 * (vert ≥ 75, ambre ≥ 50, rouge sinon) et provient des tokens `--kyb-*`
 * (le composant est toujours rendu sous un ancêtre `.landing-scope`).
 */
export default function ScoreRing({
  score = 78,
  size = 84,
}: {
  score?: number;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const radius = size * 0.4;
  const circ = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => setOffset(circ - (score / 100) * circ), 200);
    return () => clearTimeout(id);
  }, [score, circ, reduce]);

  // Sous reduced-motion : offset final immédiat, sans transition.
  const shownOffset = reduce ? circ - (score / 100) * circ : offset;

  const colorVar =
    score >= 75
      ? "var(--kyb-green)"
      : score >= 50
        ? "var(--kyb-amber)"
        : "var(--kyb-red)";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--kyb-line)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorVar}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={shownOffset}
          style={{
            transition: reduce
              ? "none"
              : "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)",
            filter: `drop-shadow(0 0 6px color-mix(in srgb, ${colorVar} 33%, transparent))`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: size * 0.26,
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--kyb-text-hi)",
          }}
        >
          <CountUp to={score} />
        </span>
        <span
          style={{
            fontSize: size * 0.11,
            letterSpacing: 1,
            color: "var(--kyb-text-low)",
          }}
        >
          /100
        </span>
      </div>
    </div>
  );
}
