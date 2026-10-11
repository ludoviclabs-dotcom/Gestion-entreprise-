"use client";

import type { EvidenceLevel } from "@/lib/graph/graph-types";
import { EVIDENCE_LABELS, communityColor } from "@/lib/graph/graph-types";
import { useGraphStore } from "@/lib/store/graph-store";
import { proofSwatchStyle } from "./proof-style";

const LEVELS: EvidenceLevel[] = ["confirmed", "declared", "inferred", "simulated"];

/**
 * Légende de la scène : niveaux de preuve des liens (ou communautés en mode
 * communauté) et forme des nœuds. Purement visuelle : le niveau de preuve est
 * aussi énoncé en texte dans l'infobulle, la fiche et la vue table.
 */
export default function Legend({ clusters }: { clusters: number[] }) {
  const community = useGraphStore((s) => s.colorMode === "community");
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-[18px] left-4 right-4 z-[var(--z-raised)] flex flex-col gap-2.5 font-mono text-micro text-muted-foreground sm:left-8 md:right-[236px]"
    >
      {community ? (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          {clusters.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: communityColor(c) }} />
              <span>C{c + 1}</span>
            </span>
          ))}
          <span className="text-subtle">communautés structurelles (Louvain)</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-[18px] gap-y-2">
          {LEVELS.map((l) => (
            <span key={l} className="flex items-center gap-2">
              <span style={proofSwatchStyle(l)} />
              <span>{EVIDENCE_LABELS[l]}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-[18px] gap-y-2 text-subtle">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span>entité racine</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-foreground" />
          <span>fait confirmé</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full border-[1.5px] border-foreground" />
          <span>déclaré</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full border-[1.5px] border-dashed border-tone-vigilance" />
          <span>inféré · à vérifier</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="size-1 rounded-full bg-foreground opacity-50" />
          <span>événement publié</span>
        </span>
      </div>
    </div>
  );
}
