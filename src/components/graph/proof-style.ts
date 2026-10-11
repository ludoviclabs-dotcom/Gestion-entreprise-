import type { CSSProperties } from "react";
import type { EvidenceLevel } from "@/lib/graph/graph-types";
import { communityColor } from "@/lib/graph/graph-types";

/*
 * Encodage visuel du niveau de preuve sur le graphe « Registre / Nuit ».
 * Double encodage (couleur + motif) pour la lecture daltonienne :
 *   confirmé = encre pleine · déclaré = filet · inféré = tirets « vigilance » ·
 *   simulé = pointillés neutres. L'accent est réservé à l'entité racine, à la
 *   sélection et aux chemins — jamais à un niveau de risque.
 * Uniquement des références de tokens (`var(--…)`) : le graphe suit le thème.
 */

type Stroke = { stroke: string; width: number; dash?: string; cap?: "round" };

export const EDGE_STROKE: Record<EvidenceLevel, Stroke> = {
  confirmed: { stroke: "var(--foreground)", width: 1.4 },
  declared: { stroke: "var(--border-control)", width: 1.1 },
  inferred: { stroke: "var(--tone-vigilance)", width: 1.4, dash: "5 4" },
  simulated: { stroke: "var(--muted-foreground)", width: 1.5, dash: "1 4", cap: "round" },
};

/** Liens « a publié » (société → annonce) : filet très fin, quel que soit le niveau. */
export const PUBLISH_STROKE: Stroke = { stroke: "var(--border-control)", width: 0.8 };

/** Échantillon de légende / de fiche : trait horizontal de 18 px. */
export function proofSwatchStyle(level: EvidenceLevel): CSSProperties {
  const border = {
    confirmed: "1.6px solid var(--foreground)",
    declared: "1px solid var(--border-control)",
    inferred: "1.6px dashed var(--tone-vigilance)",
    simulated: "2px dotted var(--muted-foreground)",
  }[level];
  return { display: "inline-block", width: 18, flex: "none", borderTop: border };
}

/** Peinture d'un nœud (corps du cercle). */
export function nodePaint(opts: {
  evidence: EvidenceLevel;
  main: boolean;
  community: boolean;
  cluster: number;
}): { fill: string; stroke: string; strokeWidth: string; dash: string; cap: string } {
  const base = { stroke: "none", strokeWidth: "", dash: "", cap: "" };
  if (opts.community)
    return { ...base, fill: communityColor(opts.cluster), stroke: "var(--background)", strokeWidth: "1.5px" };
  if (opts.main) return { ...base, fill: "var(--primary)" };
  switch (opts.evidence) {
    case "confirmed":
      return { ...base, fill: "var(--foreground)" };
    case "declared":
      return { ...base, fill: "var(--background)", stroke: "var(--foreground)", strokeWidth: "1.5px" };
    case "inferred":
      return {
        fill: "var(--background)",
        stroke: "var(--tone-vigilance)",
        strokeWidth: "1.6px",
        dash: "3 2.4",
        cap: "",
      };
    default:
      return {
        fill: "var(--background)",
        stroke: "var(--muted-foreground)",
        strokeWidth: "1.6px",
        dash: "1 3",
        cap: "round",
      };
  }
}
