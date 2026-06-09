"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Fond ambiant : ~22 nœuds dérivant lentement, reliés par des segments de
 * proximité (impossible à rendre efficacement en CSS, d'où le `<canvas>` + RAF).
 * Décoratif, `pointer-events: none`, `aria-hidden`.
 *
 * `prefers-reduced-motion` : on dessine une seule frame statique et on ne
 * planifie aucune boucle. Les positions initiales (Math.random) sont calculées
 * dans l'effect (client-only) → aucun risque de divergence d'hydratation.
 * Les teintes reproduisent --kyb-violet / --kyb-amber (le canvas ne lit pas
 * les variables CSS).
 */
export default function AmbientGraph({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = Array.from({ length: 22 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.5 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
      hue: Math.random() > 0.7 ? "#f5b544" : "#7c5cff",
    }));

    let raf = 0;
    let t = 0;

    function draw() {
      if (!ctx) return;
      const w = canvas!.width;
      const h = canvas!.height;
      ctx.clearRect(0, 0, w, h);

      if (!reduce) {
        t += 0.005;
        for (const n of nodes) {
          n.x += n.vx + Math.sin(t + n.r) * 0.00006;
          n.y += n.vy + Math.cos(t + n.r) * 0.00006;
          if (n.x < 0 || n.x > 1) n.vx *= -1;
          if (n.y < 0 || n.y > 1) n.vy *= -1;
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = (a.x - b.x) * w;
          const dy = (a.y - b.y) * h;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 260) {
            ctx.strokeStyle = `rgba(124,92,255,${0.07 * (1 - d / 260)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = n.hue;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, n.r * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    }

    function resize() {
      canvas!.width = canvas!.offsetWidth * 2;
      canvas!.height = canvas!.offsetHeight * 2;
      if (reduce) draw();
    }

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.55,
        pointerEvents: "none",
      }}
    />
  );
}
