import { describe, expect, it } from "vitest";
import { fixtureCases } from "@/lib/fixtures/cases";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeLayout } from "@/lib/graph/layout";
import { serializeGraph } from "@/lib/graph/serialize";
import type { CaseBundle, GraphDTO, LayerKey } from "@/lib/graph/graph-types";
import {
  VIEW_H,
  VIEW_W,
  buildGraphView,
  computeVisibility,
  dateAtFraction,
  layoutGraphView,
  searchMatches,
  spreadAngles,
  timeBounds,
} from "@/lib/graph/graph-view";

const TODAY = "2026-10-11";
const ALL: Record<LayerKey, boolean> = {
  gouvernance: true,
  capital: true,
  adresses: true,
  evenements: true,
  sanctions: true,
  risques: false,
};

function dtoOf(bundle: CaseBundle): GraphDTO {
  const g = buildGraph(bundle);
  computeLayout(g);
  return serializeGraph(g);
}

/** Petit dossier synthétique : racine, deux dirigeants (dont un parti), une filiale, un événement. */
function tiny(): CaseBundle {
  return {
    case: { id: "t", title: "Tiny", rootSiren: "123456789" },
    entities: [
      { id: "root", type: "company", label: "ALPHA SAS", evidenceLevel: "confirmed", attributes: { SIREN: "123 456 789" } },
      { id: "sub", type: "company", label: "BÊTA SARL", evidenceLevel: "declared" },
      { id: "p1", type: "person", label: "Élise MARTIN", evidenceLevel: "declared" },
      { id: "p2", type: "person", label: "Jean DUPONT", evidenceLevel: "declared" },
    ],
    edges: [
      { id: "d1", type: "DETIENT", source: "root", target: "sub", evidenceLevel: "inferred", weight: "60 %", label: "détient 60 %", validFrom: "2020-01-01" },
      { id: "g1", type: "DIRIGE", source: "p1", target: "root", evidenceLevel: "declared", validFrom: "2015-03-10" },
      { id: "g2", type: "DIRIGE", source: "p2", target: "root", evidenceLevel: "declared", validFrom: "2010-01-01", validTo: "2014-12-31" },
    ],
    events: [{ id: "e1", entityId: "root", kind: "depot_comptes", title: "Dépôt des comptes", occurredOn: "2018-06-30", evidenceLevel: "confirmed" }],
    riskSignals: [],
  };
}

describe("graph-view — modèle de vue", () => {
  it("trouve la racine par le SIREN du dossier et nettoie les libellés de lien", () => {
    const bundle = tiny();
    const view = buildGraphView(dtoOf(bundle), bundle, TODAY);
    expect(view.rootId).toBe("root");
    expect(view.byId.root.main).toBe(true);
    // Un lien sans libellé métier n'affiche pas son type brut (« DIRIGE »).
    expect(view.edges.find((e) => e.id === "g1")?.label).toBeUndefined();
    expect(view.edges.find((e) => e.id === "d1")?.label).toBe("détient 60 %");
    // La publication prend la date de l'événement comme date de début.
    expect(view.edges.find((e) => e.type === "A_PUBLIE")?.from).toBe("2018-06-30");
    expect(view.timeStart).toBe("2010-01-01");
    expect(view.timeEnd).toBe(TODAY);
  });

  it("chaque dossier de démonstration a une racine société et une mise en page complète, dans le cadre", () => {
    for (const { bundle } of fixtureCases) {
      const view = buildGraphView(dtoOf(bundle), bundle, TODAY);
      expect(view.rootId, bundle.case.id).not.toBeNull();
      expect(view.byId[view.rootId!].kind, bundle.case.id).toBe("company");
      const pos = layoutGraphView(view, VIEW_W, VIEW_H);
      for (const n of view.nodes) {
        const p = pos[n.id];
        expect(p, `${bundle.case.id}/${n.id}`).toBeDefined();
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        // Les entités laissent la place à leur libellé ; les événements frôlent le bord.
        const margin = n.kind === "event" ? 0 : 200;
        expect(p.x, `${bundle.case.id}/${n.id}`).toBeGreaterThanOrEqual(margin);
        expect(p.x, `${bundle.case.id}/${n.id}`).toBeLessThanOrEqual(VIEW_W - margin);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(VIEW_H);
      }
      expect(pos[view.rootId!]).toMatchObject({ x: VIEW_W / 2, y: VIEW_H / 2 });
    }
  });

  it("la mise en page est déterministe et tient un gros dossier", () => {
    const bundle: CaseBundle = {
      case: { id: "big", title: "Big", rootSiren: "000000001" },
      entities: [
        { id: "r", type: "company", label: "RACINE", evidenceLevel: "confirmed", attributes: { SIREN: "000000001" } },
        ...Array.from({ length: 180 }, (_, i) => ({
          id: `n${i}`,
          type: (i % 3 === 0 ? "company" : "person") as "company" | "person",
          label: `Entité ${i}`,
          evidenceLevel: "declared" as const,
        })),
      ],
      edges: Array.from({ length: 180 }, (_, i) => ({
        id: `x${i}`,
        type: "DIRIGE" as const,
        source: `n${i}`,
        target: i < 60 ? "r" : `n${i % 60}`,
        evidenceLevel: "declared" as const,
      })),
      events: Array.from({ length: 300 }, (_, i) => ({
        id: `ev${i}`,
        entityId: "r",
        kind: "depot",
        title: `Annonce ${i}`,
        occurredOn: `20${10 + (i % 15)}-01-01`,
        evidenceLevel: "confirmed" as const,
      })),
      riskSignals: [],
    };
    const view = buildGraphView(dtoOf(bundle), bundle, TODAY);
    expect(view.dense).toBe(true);
    const t = performance.now();
    const a = layoutGraphView(view, VIEW_W, 700);
    const b = layoutGraphView(view, VIEW_W, 700);
    expect(performance.now() - t).toBeLessThan(500);
    expect(b).toEqual(a);
    expect(Object.keys(a)).toHaveLength(view.nodes.length);
  });

  it("répartit les angles d'un anneau avec un écart minimal", () => {
    const out = spreadAngles([0, 0.01, 0.02, 3], 0.3).map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    const sorted = [...out].sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(0.3 - 1e-6);
    // Anneau saturé : espacement régulier.
    const full = spreadAngles([0, 0, 0, 0], Math.PI);
    const s2 = full.map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((x, y) => x - y);
    expect(s2[1] - s2[0]).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe("graph-view — visibilité, temps, recherche", () => {
  const bundle = tiny();
  const view = buildGraphView(dtoOf(bundle), bundle, TODAY);

  it("« qui contrôlait quand » : un lien n'existe qu'entre ses dates", () => {
    const today = computeVisibility(view, ALL, TODAY);
    expect(today.nodes.has("p2")).toBe(false); // mandat terminé en 2014
    expect(today.edges.has("g2")).toBe(false);
    expect(today.nodes.has("p1")).toBe(true);

    const in2012 = computeVisibility(view, ALL, "2012-06-01");
    expect(in2012.nodes.has("p2")).toBe(true);
    expect(in2012.nodes.has("p1")).toBe(false); // pas encore dirigeant
    expect(in2012.nodes.has("sub")).toBe(false); // détention datée de 2020
    expect(in2012.nodes.has("root")).toBe(true); // la racine reste toujours visible
    expect(in2012.counts).toMatchObject({ entities: 2, links: 1, events: 0 });

    // Sans date (aucun lien daté) : tout l'état connu.
    expect(computeVisibility(view, ALL, null).counts).toMatchObject({ entities: 4, links: 3, events: 1 });
  });

  it("les couches retirent les nœuds et leurs liens", () => {
    const v = computeVisibility(view, { ...ALL, gouvernance: false, evenements: false }, TODAY);
    expect(v.nodes.has("p1")).toBe(false);
    expect(v.edges.has("g1")).toBe(false);
    expect(v.nodes.has("e1")).toBe(false);
    expect(v.nodes.has("sub")).toBe(true);
  });

  it("bornes et fractions du curseur temporel", () => {
    expect(timeBounds([{ from: "2019-01-01" }, { to: "2017-05-02" }], TODAY).timeStart).toBe("2017-05-02");
    expect(timeBounds([{}], TODAY).timeStart).toBeNull();
    expect(dateAtFraction("2020-01-01", "2020-01-11", 0.5)).toBe("2020-01-06");
    expect(dateAtFraction("2020-01-01", "2020-01-11", 2)).toBe("2020-01-11");
  });

  it("la recherche ignore la casse et les accents, et accepte un SIREN", () => {
    expect([...searchMatches(view, "elise")]).toEqual(["p1"]);
    expect([...searchMatches(view, "BETA")]).toEqual(["sub"]);
    expect([...searchMatches(view, "123 456")]).toEqual(["root"]);
    expect(searchMatches(view, "  ").size).toBe(0);
  });
});
