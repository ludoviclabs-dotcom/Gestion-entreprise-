import type { CaseBundle, CaseEdge, CaseEntity } from "./graph-types";

/**
 * Diff structurel entre deux états d'un dossier (T0 → T1) : ce qui fait basculer
 * d'un outil « photo » vers un outil de surveillance. Pur et testable.
 */

export type EdgeFieldChange = {
  field: "weight" | "validFrom" | "validTo" | "evidenceLevel";
  before?: string;
  after?: string;
};
export type ChangedEdge = { edge: CaseEdge; changes: EdgeFieldChange[] };

export type BundleDiff = {
  addedNodes: CaseEntity[];
  removedNodes: CaseEntity[];
  addedEdges: CaseEdge[];
  removedEdges: CaseEdge[];
  changedEdges: ChangedEdge[];
  hasChanges: boolean;
};

type Snapshot = Pick<CaseBundle, "entities" | "edges">;

function edgeChanges(before: CaseEdge, after: CaseEdge): EdgeFieldChange[] {
  const fields: EdgeFieldChange["field"][] = [
    "weight",
    "validFrom",
    "validTo",
    "evidenceLevel",
  ];
  const changes: EdgeFieldChange[] = [];
  for (const field of fields) {
    const b = before[field];
    const a = after[field];
    if (b !== a) changes.push({ field, before: b, after: a });
  }
  return changes;
}

/** Compare un état antérieur `before` à l'état courant `after`. */
export function diffBundles(before: Snapshot, after: Snapshot): BundleDiff {
  const beforeNodes = new Map(before.entities.map((e) => [e.id, e]));
  const afterNodes = new Map(after.entities.map((e) => [e.id, e]));
  const beforeEdges = new Map(before.edges.map((e) => [e.id, e]));
  const afterEdges = new Map(after.edges.map((e) => [e.id, e]));

  const addedNodes = after.entities.filter((e) => !beforeNodes.has(e.id));
  const removedNodes = before.entities.filter((e) => !afterNodes.has(e.id));
  const addedEdges = after.edges.filter((e) => !beforeEdges.has(e.id));
  const removedEdges = before.edges.filter((e) => !afterEdges.has(e.id));

  const changedEdges: ChangedEdge[] = [];
  for (const edge of after.edges) {
    const prev = beforeEdges.get(edge.id);
    if (!prev) continue;
    const changes = edgeChanges(prev, edge);
    if (changes.length > 0) changedEdges.push({ edge, changes });
  }

  return {
    addedNodes,
    removedNodes,
    addedEdges,
    removedEdges,
    changedEdges,
    hasChanges:
      addedNodes.length > 0 ||
      removedNodes.length > 0 ||
      addedEdges.length > 0 ||
      removedEdges.length > 0 ||
      changedEdges.length > 0,
  };
}
