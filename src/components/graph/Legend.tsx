"use client";

import {
  NODE_COLORS,
  NODE_LABELS,
  EVIDENCE_LABELS,
  EVIDENCE_EDGE_COLORS,
  EVIDENCE_EDGE_SIZE,
} from "@/lib/graph/graph-types";
import type { NodeKind, EvidenceLevel } from "@/lib/graph/graph-types";

const KINDS: NodeKind[] = ["company", "person", "address", "event", "sanction"];
const LEVELS: EvidenceLevel[] = [
  "confirmed",
  "declared",
  "inferred",
  "simulated",
];

export default function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-20 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 p-3 backdrop-blur">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Légende
      </p>
      <div className="space-y-1.5">
        {KINDS.map((k) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span
              className="h-3 w-3 rounded-full"
              style={{
                background: NODE_COLORS[k],
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.45)",
              }}
            />
            <span>{NODE_LABELS[k]}</span>
          </div>
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Niveau de preuve
      </p>
      <div className="space-y-1.5">
        {LEVELS.map((l) => {
          // Double encodage : couleur + épaisseur ; pointillés pour inféré/simulé
          // (cohérent avec le rendu des liens du graphe — a11y daltonisme).
          const dashed = l === "inferred" || l === "simulated";
          const h = Math.max(2, EVIDENCE_EDGE_SIZE[l] - 0.5);
          return (
            <div key={l} className="flex items-center gap-2 text-xs">
              <span
                className="rounded"
                style={{
                  width: "22px",
                  height: `${h}px`,
                  background: dashed
                    ? `repeating-linear-gradient(90deg, ${EVIDENCE_EDGE_COLORS[l]} 0 4px, transparent 4px 7px)`
                    : EVIDENCE_EDGE_COLORS[l],
                }}
              />
              <span>{EVIDENCE_LABELS[l]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
