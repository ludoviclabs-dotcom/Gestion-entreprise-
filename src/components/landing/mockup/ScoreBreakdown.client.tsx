"use client";

import { motion } from "motion/react";
import ScoreRing from "../ScoreRing.client";
import CountUp from "../CountUp.client";
import StatusBadge from "./StatusBadge";
import { SCORE_FACTORS, SCORE_TODO, SCORE_TOTAL, TONE_COLOR } from "./mock-data";

/**
 * Onglet « Scores » : anneau global + décomposition par facteur. L'information
 * n'est jamais portée par la couleur seule — chaque barre a un libellé de niveau
 * et une valeur.
 */
export default function ScoreBreakdown() {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-center">
          <ScoreRing score={SCORE_TOTAL} size={82} />
          <div className="text-[10.5px] text-[var(--kyb-text-low)] sm:text-center">
            Score de conformité
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {SCORE_FACTORS.map((f, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[var(--kyb-text-mid)]">{f.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[var(--kyb-text-low)]">{f.levelLabel}</span>
                  <span className="tabular-nums text-[var(--kyb-text-hi)]">
                    <CountUp to={f.value} />
                  </span>
                </span>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-[var(--kyb-line)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: TONE_COLOR[f.tone] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${f.value}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--kyb-line)] pt-2.5">
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--kyb-text-low)]">
          Points à compléter
        </div>
        <div className="flex flex-wrap gap-2">
          {SCORE_TODO.map((t, i) => (
            <StatusBadge key={i} label={t} tone="warning" />
          ))}
        </div>
      </div>
    </div>
  );
}
