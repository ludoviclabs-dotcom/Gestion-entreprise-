import { describe, it, expect } from "vitest";
import { diffBundles } from "@/lib/graph/diff";
import { holdingUboBundle } from "@/lib/fixtures/cases/holding-ubo";

const node = (id: string, label = id) =>
  ({ id, type: "company" as const, label, evidenceLevel: "confirmed" as const });
const edge = (id: string, source: string, target: string, weight?: string) =>
  ({ id, type: "DETIENT" as const, source, target, weight, evidenceLevel: "declared" as const });

describe("diffBundles", () => {
  it("détecte ajouts, retraits et modifications", () => {
    const before = {
      entities: [node("a"), node("b")],
      edges: [edge("e1", "a", "b", "50 %"), edge("e2", "b", "a")],
    };
    const after = {
      entities: [node("a"), node("c")], // b retiré, c ajouté
      edges: [edge("e1", "a", "b", "60 %"), edge("e3", "a", "c")], // e1 modifié, e2 retiré, e3 ajouté
    };
    const d = diffBundles(before, after);
    expect(d.addedNodes.map((n) => n.id)).toEqual(["c"]);
    expect(d.removedNodes.map((n) => n.id)).toEqual(["b"]);
    expect(d.addedEdges.map((e) => e.id)).toEqual(["e3"]);
    expect(d.removedEdges.map((e) => e.id)).toEqual(["e2"]);
    expect(d.changedEdges).toHaveLength(1);
    expect(d.changedEdges[0].changes[0]).toMatchObject({ field: "weight", before: "50 %", after: "60 %" });
    expect(d.hasChanges).toBe(true);
  });

  it("hasChanges=false sur deux états identiques", () => {
    const snap = { entities: [node("a")], edges: [edge("e1", "a", "a")] };
    expect(diffBundles(snap, snap).hasChanges).toBe(false);
  });

  it("fixture holding-ubo : montée MOREAU + nouvelles entrées BENALI/HADDAD", () => {
    const prev = holdingUboBundle.previous!;
    const d = diffBundles(prev, {
      entities: holdingUboBundle.entities,
      edges: holdingUboBundle.edges,
    });
    expect(d.addedEdges.map((e) => e.id).sort()).toEqual(["g2", "u8"]);
    const u3 = d.changedEdges.find((c) => c.edge.id === "u3");
    expect(u3?.changes.some((c) => c.field === "weight" && c.before === "50 %" && c.after === "60 %")).toBe(true);
  });
});
