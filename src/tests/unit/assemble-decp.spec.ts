import { describe, it, expect, afterEach, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, status: "ok", calls: 0 }));
vi.mock("@/lib/env", async () => ({ ...await vi.importActual("@/lib/env"), isDecpEnabled: () => state.enabled }));
const ok = (raw: unknown) => ({ raw, endpoint: "db:source", httpStatus: 200, isFixture: false });
vi.mock("@/lib/connectors/sirene", () => ({ sirene: {
  getUniteLegale: async () => ok({ uniteLegale: { siren: "356000000", dateCreationUniteLegale: "1991-01-01",
    periodesUniteLegale: [{ denominationUniteLegale: "SOCIETE TEMOIN", categorieJuridiqueUniteLegale: "5599", etatAdministratifUniteLegale: "A" }] } }),
  getEtablissementSiege: async () => ok({}),
} }));
vi.mock("@/lib/connectors/bodacc", () => ({ bodacc: { bySiren: async () => ok({ results: [] }) } }));
vi.mock("@/lib/connectors/decp", () => ({ decp: { bySiren: async () => {
  state.calls++;
  if (state.status !== "ok" && state.status !== "absent") return { raw: { status: state.status },
    endpoint: `db:decp (${state.status === "non_importe" ? "source non importée" : "exception"})`, httpStatus: 503, isFixture: false };
  const empty = { total: 0, reliableAmount: 0, singleReliable: 0, grouped: 0, unreliable: 0, lastNotified: null, buyers: [], items: [] };
  return ok({ status: "ok", siren: "356000000", importedAt: "2026-10-12T12:00:00.000Z", windowStart: "2025-10-12", windowEnd: "2026-10-12", latestFileMonth: "2026-10",
    holder: state.status === "absent" ? empty : { ...empty, total: 1, singleReliable: 1, reliableAmount: 1000, lastNotified: "2026-09-01", items: [{ key: "a".repeat(32),
      marketId: "b".repeat(64), objectHash: "c".repeat(12), buyerId: "55208131700001", holderId: "35600000000002", cpv: "45000000", notifiedOn: "2026-09-01", holderCount: 1, amount: 1000, amountUnreliable: false }] }, buyer: empty });
} } }));
import { assembleCase } from "@/lib/ingestion/assemble-case";
describe("assemblage DECP", () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; state.enabled = true; state.status = "ok"; state.calls = 0; });
  it("attributs et événements informatifs avec provenance, sans changer les scores ni les signaux", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.enabled = false; const baseline = await assembleCase("356000000"); state.enabled = true;
    for (const status of ["ok", "absent", "non_importe", "indisponible"]) {
      state.status = status; const result = await assembleCase("356000000");
      expect(result.sources.filter(s => s.source === "decp")).toHaveLength(1); expect(result.timings.decp).toBeGreaterThanOrEqual(0);
      expect(result.bundle.case.scores).toEqual(baseline.bundle.case.scores); expect(result.bundle.riskSignals).toEqual(baseline.bundle.riskSignals);
      expect(result.bundle.edges).toEqual(baseline.bundle.edges);
      const attr = result.bundle.entities.find(e => e.id === "co:356000000")?.attributes?.["Marchés publics attribués (DECP)"];
      if (status === "ok") { expect(attr).toContain("1 marché(s)"); expect(result.bundle.events.some(e => e.kind === "marche_public_attribue")).toBe(true); }
      else if (status === "absent") expect(attr).toContain("Aucun marché notifié sur la fenêtre importée");
      else { expect(attr).toBeUndefined(); expect(result.bundle.events).toEqual(baseline.bundle.events); }
    }
  });
  it("démo ou drapeau éteint : zéro appel et aucune source inventée", async () => {
    expect((await assembleCase("356000000")).sources.some(s => s.source === "decp")).toBe(false);
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.enabled = false;
    expect((await assembleCase("356000000")).sources.some(s => s.source === "decp")).toBe(false); expect(state.calls).toBe(0);
  });
});
