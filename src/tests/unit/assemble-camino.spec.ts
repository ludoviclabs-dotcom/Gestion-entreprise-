import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegale from "@/lib/fixtures/sirene-unite-legale.sample.json";
import siege from "@/lib/fixtures/sirene-etablissement.sample.json";
const state = vi.hoisted(() => ({ enabled: true, failed: false, calls: 0 }));
vi.mock("@/lib/env", async () => ({ ...await vi.importActual("@/lib/env"), isCaminoEnabled: () => state.enabled }));
const ok = (raw: unknown) => ({ raw, endpoint: "https://source.test", httpStatus: 200, isFixture: false });
vi.mock("@/lib/connectors/sirene", () => ({ sirene: {
  getUniteLegale: async () => ok(uniteLegale), getEtablissementSiege: async () => ok(siege),
} }));
vi.mock("@/lib/connectors/bodacc", () => ({ bodacc: { bySiren: async () => ok({ results: [] }) } }));
vi.mock("@/lib/connectors/camino", () => ({ camino: { bySiren: async () => {
  state.calls++;
  if (state.failed) return { ...ok({ status: "indisponible" }), endpoint: "db:camino (exception)", httpStatus: 503 };
  return ok({ status: "ok", importedAt: "2026-10-10T10:00:00.000Z", total: 1,
    byStatus: [{ label: "valide", count: 1 }], byDomain: [{ label: "métaux", count: 1 }], validUntil: null,
    items: [{ id: "mine", name: "Mine", type: "concession", status: "valide", domain: "métaux", startsOn: "2000-01-01", endsOn: null, holder: true, operator: false }] });
} } }));
import { assembleCase } from "@/lib/ingestion/assemble-case";
describe("assemblage Camino", () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; state.enabled = true; state.failed = false; state.calls = 0; });
  it("branche les attributs, événements et provenance en live sans modifier les scores", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.enabled = false;
    const baseline = await assembleCase("552032534");
    state.enabled = true;
    const result = await assembleCase("552032534");
    expect(state.calls).toBe(1);
    expect(result.sources.some(s => s.source === "camino")).toBe(true);
    expect(result.bundle.events.some(e => e.kind === "titre_minier_debut")).toBe(true);
    expect(result.bundle.entities.find(e => e.id === "co:552032534")?.attributes?.["Titres miniers (Camino)"]).toContain("1 titre(s)");
    expect(result.bundle.case.scores).toEqual(baseline.bundle.case.scores);
    expect(result.bundle.riskSignals).toEqual(baseline.bundle.riskSignals);
  });
  it("isole une panne et ne produit pas d'attribut rassurant", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.failed = true;
    const { bundle, sources } = await assembleCase("552032534");
    expect(sources.find(s => s.source === "camino")?.httpStatus).toBe(503);
    expect(bundle.events.some(e => e.kind.startsWith("titre_minier"))).toBe(false);
    expect(bundle.entities.some(e => e.attributes?.["Titres miniers (Camino)"])).toBe(false);
  });
  it("ne consulte rien en démo ou désactivé", async () => {
    expect((await assembleCase("552032534")).sources.some(s => s.source === "camino")).toBe(false);
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.enabled = false;
    expect((await assembleCase("552032534")).sources.some(s => s.source === "camino")).toBe(false);
    expect(state.calls).toBe(0);
  });
});
