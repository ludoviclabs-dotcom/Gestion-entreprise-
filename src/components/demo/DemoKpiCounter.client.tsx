"use client";

import { useEffect, useRef, useState } from "react";
import { scoreColor, type Tone } from "@/components/cases/ScorePills";

interface KpiCounterProps {
  label: string;
  target: number;
  /** Durée du comptage en ms. */
  duration?: number;
  /** Sens du score (mêmes seuils que ScorePills : risk = haut → rouge). */
  tone?: Tone;
  /** Si target >= threshold : micro-pulse d'attention à la fin du comptage. */
  warningThreshold?: number;
  /** Affiche directement la valeur finale (bouton Passer / reduced-motion). */
  instant?: boolean;
  onComplete?: () => void;
}

/**
 * Compteur KPI animé en rAF (easeOutCubic) — même approche que
 * `landing/CountUp.client.tsx`. La couleur suit en continu les seuils produit
 * (ScorePills), si bien que le score « traverse » vert → ambre → rouge en
 * comptant, comme dans le vrai produit.
 */
export default function DemoKpiCounter({
  label,
  target,
  duration = 1200,
  tone = "risk",
  warningThreshold,
  instant = false,
  onComplete,
}: KpiCounterProps) {
  const [val, setVal] = useState(0);
  const [done, setDone] = useState(false);
  // Dernier callback sans relancer le comptage quand le parent re-rend.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (instant) return;
    let raf = 0;
    const startAt = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startAt) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDone(true);
        onCompleteRef.current?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, instant]);

  // Sous `instant` (Passer / reduced-motion), valeur finale dérivée au rendu —
  // pas de setState dans l'effect (même approche que landing/CountUp).
  const display = instant ? target : val;
  const isDone = instant || done;
  const emphasized =
    isDone && warningThreshold !== undefined && target >= warningThreshold;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a1227]/70 px-3 py-1.5">
      <span className="text-xs text-[var(--kyb-text-mid)]">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums${emphasized ? " demo-badge-pulse" : ""}`}
        style={{ color: scoreColor(display, tone) }}
      >
        {display}
      </span>
    </div>
  );
}
