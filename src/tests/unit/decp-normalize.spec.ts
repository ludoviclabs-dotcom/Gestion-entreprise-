import { describe, it, expect } from "vitest";
import { decpAttributes, normalizeDecp } from "@/lib/ingestion/normalize-decp";
import type { DecpRaw } from "@/lib/ingestion/decp-data";
import type { CaseBundle } from "@/lib/graph/graph-types";
import { isInformationalEvent } from "@/lib/graph/informational-events";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeRisk, explainQualitePreuve, SCORE_MODEL_VERSION } from "@/lib/risk/engine";
import { computeGraphMetrics } from "@/lib/graph/algorithms";
import { GraphologyQueryRepository } from "@/lib/data/graph-query-repository";
import { inferEventSource } from "@/lib/data/case-quality";
const empty = { total: 0, reliableAmount: 0, singleReliable: 0, grouped: 0, unreliable: 0, lastNotified: null, buyers: [], items: [] };
const item = { key: "a".repeat(32), marketId: "b".repeat(64), objectHash: "c".repeat(12), buyerId: "55208131700001", holderId: "35600000000002", cpv: "45000000", notifiedOn: "2026-09-01", holderCount: 2, amount: 9000, amountUnreliable: false };
const data: DecpRaw = { status: "ok", siren: "356000000", importedAt: "2026-10-12T12:00:00.000Z", windowStart: "2025-10-12", windowEnd: "2026-10-12", latestFileMonth: "2026-10",
  holder: { ...empty, total: 1, grouped: 1, lastNotified: item.notifiedOn, buyers: [{ id: item.buyerId, count: 1 }], items: [item] }, buyer: empty };
describe("DECP rendu et non-régression des scores", () => {
  it("texte stable, pas de nom ni objet, limites et groupement non réparti explicités", () => {
    const attrs = decpAttributes(data);
    expect(Object.keys(attrs)).toEqual(["Marchés publics attribués (DECP)", "Commande publique (acheteur, DECP)"]);
    expect(attrs["Marchés publics attribués (DECP)"]).toContain("montant non réparti");
    expect(attrs["Marchés publics attribués (DECP)"]).toContain("montant cumulé déclaré : 0 EUR");
    expect(attrs["Marchés publics attribués (DECP)"]).toContain("modifications non exploitées");
    expect(attrs["Commande publique (acheteur, DECP)"]).toContain("Aucun marché notifié sur la fenêtre importée");
    expect(JSON.stringify(attrs)).not.toMatch(/fraude|sanction|infraction|PRIVATE_/i);
  });
  it("rejette les schémas corrompus et les dates hors fenêtre sans rassurer", () => {
    for (const raw of [null, [], {}, { ...data, windowStart: "invalid" }, { ...data, holder: { ...data.holder, items: [{ ...item, notifiedOn: "2066-01-01" }] } }]) {
      expect(decpAttributes(raw)).toEqual({}); expect(normalizeDecp(raw, "co:356000000")).toEqual([]);
    }
  });
  it("20 événements au total même avec les deux rôles, dédoublonnés et attribués à la source DECP", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ ...item, buyerId: "35600000000001", key: i.toString(16).padStart(32, "0") }));
    const events = normalizeDecp({ ...data, holder: { ...data.holder, items }, buyer: { ...data.holder, items } }, "co:356000000");
    expect(events).toHaveLength(20); expect(new Set(events.map(e => e.id)).size).toBe(20);
    for (const e of events) { expect(inferEventSource(e)).toBe("decp"); expect(e.evidenceLevel).toBe("declared"); expect(isInformationalEvent(e)).toBe(true); }
    expect(isInformationalEvent({ kind: "marche_public_resultat" })).toBe(false);
  });
  it("préserve les trois scores, signaux, règles, qualité de preuve et métriques ; graphe affiché intact", async () => {
    const baseline: CaseBundle = { case: { id: "x", title: "SOCIETE TEMOIN", rootSiren: "356000000" },
      entities: [{ id: "co:356000000", type: "company", label: "SOCIETE TEMOIN", evidenceLevel: "confirmed" },
        { id: "co:y", type: "company", label: "AUTRE SOCIETE", evidenceLevel: "inferred" }],
      edges: [{ id: "edge", source: "co:356000000", target: "co:y", type: "DETIENT", evidenceLevel: "inferred" }],
      events: [{ id: "old", entityId: "co:356000000", kind: "modification", title: "Annonce", evidenceLevel: "confirmed", source: "BODACC" }], riskSignals: [] };
    const enriched = { ...baseline, events: [...baseline.events, ...normalizeDecp(data, "co:356000000")] };
    const graph = buildGraph(enriched), before = graph.export();
    expect(computeRisk(enriched, graph)).toEqual(computeRisk(baseline, buildGraph(baseline)));
    expect(explainQualitePreuve(enriched)).toEqual(explainQualitePreuve(baseline));
    expect(computeGraphMetrics(graph)).toEqual(computeGraphMetrics(buildGraph(baseline)));
    expect(await new GraphologyQueryRepository().metrics(enriched)).toEqual(await new GraphologyQueryRepository().metrics(baseline));
    expect(graph.export()).toEqual(before); expect(SCORE_MODEL_VERSION).toBe("kyb-risk-2026.2");
  });
});
