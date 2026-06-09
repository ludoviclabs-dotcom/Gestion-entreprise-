"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Compteur animé (easeOutCubic). Respecte `prefers-reduced-motion` : saut
 * direct à la valeur finale. L'id RAF reste local à l'effect (compatible
 * React Compiler — aucune mutation de ref pendant le render).
 */
export default function CountUp({
  to,
  duration = 1400,
  suffix = "",
}: {
  to: number;
  duration?: number;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduce]);

  // Sous reduced-motion, on affiche directement la valeur finale (pas de
  // setState synchrone dans l'effect).
  const display = reduce ? to : val;

  return (
    <>
      {display}
      {suffix}
    </>
  );
}
