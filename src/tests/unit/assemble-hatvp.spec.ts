import { describe, it, expect, afterEach, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, status: "ok", calls: 0 }));
vi.mock("@/lib/env", async () => ({ ...await vi.importActual("@/lib/env"), isHatvpEnabled: () => state.enabled }));
const ok = (raw: unknown) => ({ raw, endpoint: "db:source", httpStatus: 200, isFixture: false });
vi.mock("@/lib/connectors/sirene", () => ({ sirene: {
  getUniteLegale: async () => ok({ uniteLegale: { siren: "552032534", dateCreationUniteLegale: "1973-01-01",
    periodesUniteLegale: [{ denominationUniteLegale: "SOCIETE TEMOIN", categorieJuridiqueUniteLegale: "5599", etatAdministratifUniteLegale: "A" }] } }),
  getEtablissementSiege: async () => ok({}),
} }));
vi.mock("@/lib/connectors/bodacc", () => ({ bodacc: { bySiren: async () => ok({ results: [] }) } }));
vi.mock("@/lib/connectors/hatvp", () => ({ hatvp: { bySiren: async () => {
  state.calls++;
  if (state.status !== "ok" && state.status !== "absent") return {
    raw: { status: state.status }, endpoint: `db:hatvp (${state.status === "non_importe" ? "source non importée" : "exception"})`, httpStatus: 503, isFixture: false };
  return ok({ status: "ok", importedAt: "2026-10-11T12:00:00.000Z", organisation: state.status === "absent" ? null : {
    siren: "552032534", categoryCode: "TRAIND", categoryLabel: "Travailleur indépendant", categoryGroup: "JURISTE",
    firstPublishedOn: "2020-02-15", lastActivityPublishedOn: null, activitiesPublished: null,
    lastExerciseEnd: null, activityCountLast: null, noActivityDeclared: null, ceasedOn: null, deregistrationReason: null } });
} } }));
import { assembleCase } from "@/lib/ingestion/assemble-case";
import { SCORE_MODEL_VERSION } from "@/lib/risk/engine";

describe("assemblage HATVP", () => {
  afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; state.enabled = true; state.status = "ok"; state.calls = 0; });
  it("ajoute seulement un attribut et une provenance, sans effet sur les trois scores, signaux ou graphe", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.enabled = false;
    const baseline = await assembleCase("552032534");
    state.enabled = true;
    for (const status of ["ok", "absent", "non_importe", "indisponible"]) {
      state.status = status;
      const result = await assembleCase("552032534");
      expect(result.sources.filter(s => s.source === "hatvp")).toHaveLength(1);
      expect(result.timings.hatvp).toBeGreaterThanOrEqual(0);
      expect(result.bundle.case.scores).toEqual(baseline.bundle.case.scores);
      expect(result.bundle.riskSignals).toEqual(baseline.bundle.riskSignals);
      expect(result.bundle.edges).toEqual(baseline.bundle.edges);
      expect(result.bundle.events).toEqual(baseline.bundle.events);
      expect(result.bundle.entities.map(e => ({ id: e.id, type: e.type, label: e.label })))
        .toEqual(baseline.bundle.entities.map(e => ({ id: e.id, type: e.type, label: e.label })));
      const attr = result.bundle.entities.find(e => e.id === "co:552032534")?.attributes?.["Répertoire HATVP"];
      if (status === "ok") expect(attr).toContain("Inscrite au répertoire HATVP");
      else if (status === "absent") expect(attr).toContain("Non inscrite dans le jeu importé");
      else expect(attr).toBeUndefined();
    }
    expect(SCORE_MODEL_VERSION).toBe("kyb-risk-2026.2");
  });
  it("ne consulte rien en démo ou désactivé et ne crée aucune source inventée", async () => {
    expect((await assembleCase("552032534")).sources.some(s => s.source === "hatvp")).toBe(false);
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.enabled = false;
    expect((await assembleCase("552032534")).sources.some(s => s.source === "hatvp")).toBe(false);
    expect(state.calls).toBe(0);
  });
});
