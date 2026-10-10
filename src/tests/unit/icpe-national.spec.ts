import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({ demo: false, enabled: true, geo: true, execute: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: () => state.demo, isIcpeImportEnabled: () => state.enabled, isGeorisquesEnabled: () => state.geo }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ execute: state.execute }) }));
import { icpeImport } from "@/lib/connectors/icpe-import";
import { icpeSummary } from "@/lib/ingestion/normalize-regulatory";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import type { ImportedIcpeRaw } from "@/lib/ingestion/icpe-data";
const data: ImportedIcpeRaw = { status: "ok", coverage: "national-import", importedAt: "2026-10-10T10:00:00.000Z", total: 105,
  establishments: 80, byRegime: [{ label: "Autorisation", count: 105 }], byStatus: [{ label: "En exploitation avec titre", count: 105 }],
  bySeveso: [{ label: "Seveso seuil haut", count: 2 }, { label: "Non Seveso", count: 103 }], ied: 7, nationalPriority: 3, inspections: 400, lastInspection: "2026-09-30",
  sites: [{ codeAiot: "a", siret: "55208131700000", name: "SITE", commune: "LYON", regime: "Autorisation", seveso: "Non Seveso", ied: false,
    nationalPriority: false, status: null, inspections: 1, lastInspection: "2026-01-01" }] };
const row = (d = data) => ({ imported_at: d.importedAt, total: d.total, establishments: d.establishments, by_regime: d.byRegime, by_status: d.byStatus,
  by_seveso: d.bySeveso, ied: d.ied, national_priority: d.nationalPriority, inspections: d.inspections, last_inspection: d.lastInspection, sites: d.sites });
describe("ICPE nationales — lecture et synthèse", () => {
  beforeEach(() => { state.demo = false; state.enabled = true; state.geo = true; state.execute.mockReset(); });
  it("aucune lecture en démo ou si l'un des flags manque", async () => {
    state.demo = true; expect((await icpeImport.bySiren("552081317")).isFixture).toBe(true);
    state.demo = false; state.enabled = false; expect((await icpeImport.bySiren("552081317")).httpStatus).toBe(0);
    state.enabled = true; state.geo = false; expect((await icpeImport.bySiren("552081317")).isFixture).toBe(true);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("une requête cohérente et paramétrée, total complet indépendant du détail plafonné", async () => {
    state.execute.mockResolvedValue({ rows: [row()] });
    const r = await icpeImport.bySiren("552081317"); expect(r.raw).toEqual(data);
    expect(state.execute).toHaveBeenCalledTimes(1);
    const q = new PgDialect().sqlToQuery(state.execute.mock.calls[0][0]);
    expect(q.params).toEqual(["552081317"]); expect(q.sql).toContain("s.siren = $1"); expect(q.sql).toContain("limit 20");
    expect(q.sql).toContain("count(distinct siret)"); expect(q.sql).toContain("status = 'ok'");
    const text = icpeSummary(r.raw)!;
    expect(text).toContain("105 installations classées"); expect(text).toContain("80 établissements");
    expect(text).toContain("directive IED ×7"); expect(text).toContain("400 inspections"); expect(text).toContain("2026-09-30");
    expect(text).toContain("2026-10-10"); expect(text).toContain("SIRET exploitables"); expect(text).not.toMatch(/fraude|sanction|infraction|couverture partielle/);
  });
  it("distingue pas d'import, panne et véritable absence", async () => {
    state.execute.mockResolvedValueOnce({ rows: [] });
    const missing = await icpeImport.bySiren("552081317"); expect(missing.raw).toEqual({ status: "non_importe" });
    expect(isDegradedEndpoint(missing.endpoint)).toBe(true); expect(icpeSummary(missing.raw)).toBeNull();
    state.execute.mockRejectedValueOnce(new Error("postgres://SECRET"));
    const failed = await icpeImport.bySiren("552081317"); expect(failed.raw).toEqual({ status: "indisponible" });
    expect(JSON.stringify(failed)).not.toContain("SECRET"); expect(icpeSummary(failed.raw)).toBeNull();
    state.execute.mockResolvedValueOnce({ rows: [row({ ...data, total: 0, establishments: 0, byRegime: [], byStatus: [], bySeveso: [], ied: 0, nationalPriority: 0, inspections: 0, lastInspection: null, sites: [] })] });
    const absent = await icpeImport.bySiren("552081317"); expect(absent.httpStatus).toBe(200);
    expect(icpeSummary(absent.raw)).toContain("Aucune installation classée rapprochée");
  });
  it("rejette injection, identifiants erronés, schéma invalide et sites d'un autre SIREN", async () => {
    for (const siren of ["000000000", "552081318", "552081317' OR true"]) expect((await icpeImport.bySiren(siren)).httpStatus).toBe(400);
    expect(state.execute).not.toHaveBeenCalled();
    for (const bad of [{ ...row(), total: "unknown" }, { ...row(), sites: [{ ...data.sites[0], siret: "34326262200000" }] }]) {
      state.execute.mockResolvedValue({ rows: [bad] }); expect((await icpeImport.bySiren("552081317")).endpoint).toContain("schéma non reconnu");
    }
    expect(icpeSummary({ ...data, sites: [null] })).toBeNull();
    expect(icpeSummary({ ...data, total: -1 })).toBeNull();
  });
});
