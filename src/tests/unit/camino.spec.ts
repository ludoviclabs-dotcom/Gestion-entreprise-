import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({ demo: false, enabled: true, execute: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: () => state.demo, isCaminoEnabled: () => state.enabled }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ execute: state.execute }) }));
import { camino } from "@/lib/connectors/camino";
import { caminoAttributes, normalizeCamino } from "@/lib/ingestion/normalize-camino";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import { computeRisk, explainQualitePreuve } from "@/lib/risk/engine";
import { reseauMultiDirigeantsBundle } from "@/lib/fixtures/cases/reseau-multi-dirigeants";
import { buildGraph } from "@/lib/graph/build-graph";
import type { CaseBundle } from "@/lib/graph/graph-types";
import type { CaminoRaw } from "@/lib/ingestion/camino-data";

const data: CaminoRaw = { status: "ok", importedAt: "2026-10-10T10:00:00.000Z", total: 25,
  byStatus: [{ label: "échu", count: 25 }], byDomain: [{ label: "métaux", count: 25 }], validUntil: null,
  items: [{ id: "m-1", name: "Mine exemple", type: "concession", domain: "métaux", status: "échu",
    startsOn: "2000-01-01", endsOn: "2010-01-01", holder: true, operator: false }] };
const dbRow = (d = data) => ({ imported_at: d.importedAt, total: d.total, by_status: d.byStatus,
  by_domain: d.byDomain, valid_until: d.validUntil, items: d.items });

describe("Camino lecture et rendu", () => {
  beforeEach(() => { state.demo = false; state.enabled = true; state.execute.mockReset(); });
  it("reste inerte en démo et désactivé", async () => {
    state.demo = true;
    expect((await camino.bySiren("552081317")).isFixture).toBe(true);
    state.demo = false; state.enabled = false;
    expect((await camino.bySiren("552081317")).httpStatus).toBe(0);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("lit snapshot et données dans une requête paramétrée, avec total complet", async () => {
    state.execute.mockResolvedValue({ rows: [dbRow()] });
    const r = await camino.bySiren("552081317");
    expect(r.httpStatus).toBe(200);
    expect(r.raw).toEqual(data);
    expect(state.execute).toHaveBeenCalledTimes(1);
    const q = new PgDialect().sqlToQuery(state.execute.mock.calls[0][0]);
    expect(q.params).toEqual(["552081317"]);
    expect(q.sql).toContain("t.siren = $1");
    expect(q.sql).toContain("limit 20");
    expect(q.sql).toContain("status = 'ok'");
    expect(Object.values(caminoAttributes(r.raw))[0]).toContain("25 titre(s)");
  });
  it("rejette l'injection et les SIREN invalides avant tout accès", async () => {
    for (const s of ["552081317' OR true", "000000000", "552081318"]) {
      const r = await camino.bySiren(s);
      expect(r.httpStatus).toBe(400);
      expect(isDegradedEndpoint(r.endpoint)).toBe(true);
    }
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("distingue aucun import et absence dans un import valide", async () => {
    state.execute.mockResolvedValueOnce({ rows: [] });
    const missing = await camino.bySiren("552081317");
    expect(missing.endpoint).toContain("(source non importée)");
    expect(isDegradedEndpoint(missing.endpoint)).toBe(true);
    expect(caminoAttributes(missing.raw)).toEqual({});
    state.execute.mockResolvedValueOnce({ rows: [dbRow({ ...data, total: 0, byStatus: [], byDomain: [], items: [] })] });
    const absent = await camino.bySiren("552081317");
    expect(absent.httpStatus).toBe(200);
    expect(Object.values(caminoAttributes(absent.raw))[0]).toContain("Aucun titre rapproché");
  });
  it("isole les erreurs sans exposer leur contenu ni inventer une absence", async () => {
    state.execute.mockRejectedValue(new Error("postgres://SECRET"));
    const r = await camino.bySiren("552081317");
    expect(r.endpoint).toContain("(exception)");
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(caminoAttributes(r.raw)).toEqual({});
    state.execute.mockResolvedValue({ rows: [{ ...dbRow(), total: "invalid" }] });
    expect((await camino.bySiren("552081317")).endpoint).toContain("(schéma non reconnu)");
  });
  it("normalise défensivement et émet seulement des dates déclarées plafonnées", () => {
    for (const raw of [null, 3, [], {}, { ...data, items: [null] }, { ...data, items: [{ ...data.items[0], endsOn: "2030-02-31" }] }]) {
      expect(caminoAttributes(raw)).toEqual({}); expect(normalizeCamino(raw, "co:x")).toEqual([]);
    }
    const raw = { ...data, items: Array.from({ length: 20 }, (_, i) => ({ ...data.items[0], id: String(i) })) };
    const events = normalizeCamino(raw, "co:x");
    expect(events).toHaveLength(20);
    expect(events.every(e => e.entityId === "co:x" && e.occurredOn && e.evidenceLevel === "declared")).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/octroi|fraude|sanction|infraction/i);
    expect(normalizeCamino({ ...data, items: [{ ...data.items[0], startsOn: null, endsOn: null }] }, "co:x")).toEqual([]);
    expect(Object.values(caminoAttributes(data))[0]).toContain("2026-10-10");
  });
  it("ne change aucun score, signal ou métrique de règle, ni le graphe affiché", () => {
    const bundle: CaseBundle = { case: { id: "x", title: "x", rootSiren: "552081317" },
      entities: [{ id: "co:x", label: "X", type: "company", evidenceLevel: "confirmed" },
        { id: "co:y", label: "Y", type: "company", evidenceLevel: "inferred" }],
      edges: [{ id: "edge", source: "co:x", target: "co:y", type: "DETIENT", evidenceLevel: "inferred" }],
      events: [], riskSignals: [] };
    const baseline = computeRisk(bundle, buildGraph(bundle));
    const enriched = { ...bundle, events: normalizeCamino(data, "co:x") };
    const graph = buildGraph(enriched), original = graph.export();
    expect(computeRisk(enriched, graph)).toEqual(baseline);
    expect(explainQualitePreuve(enriched)).toEqual(explainQualitePreuve(bundle));
    expect(graph.export()).toEqual(original);
    expect(enriched.events).toHaveLength(2);
    const network = reseauMultiDirigeantsBundle;
    const expanded = { ...network, events: [...network.events, ...normalizeCamino(data, network.entities[0].id)] };
    expect(computeRisk(expanded, buildGraph(expanded))).toEqual(computeRisk(network, buildGraph(network)));
    expect(explainQualitePreuve(expanded)).toEqual(explainQualitePreuve(network));
    const spy = vi.fn(() => []);
    computeRisk(enriched, graph, { rules: [{ id: "check", evaluate: spy } as never] });
    expect(spy.mock.calls[0]).toBeDefined();
    const ctx = (spy.mock.calls as unknown as [{ graph: typeof graph; bundle: CaseBundle }][])[0][0];
    expect(ctx.graph.order).toBe(2);
    expect(ctx.bundle.events).toHaveLength(0);
  });
});
