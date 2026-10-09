import type { CaseEdge } from "@/lib/graph/graph-types";

/**
 * Attributs libres d'un lien, conservés dans `edges.attributes` (jsonb) :
 * libellé, extrait, droits de vote distincts du capital et droits
 * particuliers. Sans eux, un dossier rouvert retomberait sur des votes
 * supposés égaux au capital et changerait de qualification UBO.
 */
export type EdgeAttributes = Pick<CaseEdge, "label" | "excerpt" | "votingWeight" | "specialRights">;

export function edgeAttributes(edge: CaseEdge): EdgeAttributes {
  return {
    label: edge.label,
    excerpt: edge.excerpt,
    ...(edge.votingWeight ? { votingWeight: edge.votingWeight } : {}),
    ...(edge.specialRights ? { specialRights: edge.specialRights } : {}),
  };
}

export function readEdgeAttributes(raw: unknown): EdgeAttributes {
  const a = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    label: str(a.label),
    excerpt: str(a.excerpt),
    votingWeight: str(a.votingWeight),
    specialRights: str(a.specialRights),
  };
}
