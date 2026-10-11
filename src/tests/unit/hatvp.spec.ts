import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { hatvpCategory } from "@/lib/ingestion/hatvp-categories";
const state = vi.hoisted(() => ({ demo: false, enabled: true, execute: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: () => state.demo, isHatvpEnabled: () => state.enabled }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ execute: state.execute }) }));
import { hatvp } from "@/lib/connectors/hatvp";
import { hatvpAttributes } from "@/lib/ingestion/normalize-hatvp";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import { getSourceHealth } from "@/lib/data/case-quality";
import { importFreshness } from "@/lib/data/import-freshness";

const category = hatvpCategory("TRAIND")!;
const organisation = { siren: "552081317", categoryCode: category.code, categoryLabel: category.label, categoryGroup: category.group,
  firstPublishedOn: "2020-02-15", lastActivityPublishedOn: "2026-03-01", activitiesPublished: true,
  lastExerciseEnd: "2026-12-31", activityCountLast: 0, noActivityDeclared: false, ceasedOn: null, deregistrationReason: null };
const data = { status: "ok", importedAt: "2026-10-11T12:00:00.000Z", organisation };
const dbRow = { imported_at: data.importedAt, last_status: "ok", organisation };

describe("HATVP — lecture et rendu", () => {
  beforeEach(() => { state.demo = false; state.enabled = true; state.execute.mockReset(); });
  it("reste inerte en démo et désactivé", async () => {
    state.demo = true; expect((await hatvp.bySiren("552081317")).isFixture).toBe(true);
    state.demo = false; state.enabled = false; expect((await hatvp.bySiren("552081317")).httpStatus).toBe(0);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("lit import et organisation dans une seule requête paramétrée, sans appel externe", async () => {
    state.execute.mockResolvedValue({ rows: [dbRow] });
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      const r = await hatvp.bySiren("552081317"); expect(r.raw).toEqual(data);
      expect(state.execute).toHaveBeenCalledTimes(1); expect(fetcher).not.toHaveBeenCalled();
      const q = new PgDialect().sqlToQuery(state.execute.mock.calls[0][0]);
      expect(q.params).toEqual(["552081317"]); expect(q.sql).toContain("h.siren = $1"); expect(q.sql).toContain("status = 'ok'");
      expect(q.sql).not.toMatch(/select\s+\*|denomination|nomUsage|lienSiteWeb|dirigeants/);
    } finally { fetcher.mockRestore(); }
  });
  it("rejette injection et identifiants invalides avant accès DB", async () => {
    for (const s of ["000000000", "552081318", "55208131700000", "552081317' OR true"]) expect((await hatvp.bySiren(s)).httpStatus).toBe(400);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("distingue absent, non importé, import initial échoué et panne DB", async () => {
    state.execute.mockResolvedValueOnce({ rows: [{ imported_at: null, last_status: null, organisation: null }] });
    const missing = await hatvp.bySiren("552081317");
    expect(missing.raw).toEqual({ status: "non_importe" }); expect(missing.endpoint).toContain("(source non importée)");
    state.execute.mockResolvedValueOnce({ rows: [{ imported_at: null, last_status: "failed", organisation: null }] });
    const initialFailure = await hatvp.bySiren("552081317"); expect(initialFailure.endpoint).toContain("(exception)");
    state.execute.mockRejectedValueOnce(new Error("ERREUR_CONFIDENTIELLE"));
    const failed = await hatvp.bySiren("552081317"); expect(failed.endpoint).toContain("(exception)"); expect(JSON.stringify(failed)).not.toContain("CONFIDENTIELLE");
    for (const r of [missing, failed, initialFailure]) {
      expect(isDegradedEndpoint(r.endpoint)).toBe(true); expect(hatvpAttributes(r.raw)).toEqual({});
      expect(getSourceHealth([{ ...r, source: "hatvp" }]).failed).toBe(1);
    }
    state.execute.mockResolvedValueOnce({ rows: [{ ...dbRow, organisation: null }] });
    const absent = await hatvp.bySiren("552081317"); expect(absent.httpStatus).toBe(200);
    expect(hatvpAttributes(absent.raw)["Répertoire HATVP"]).toContain("Non inscrite dans le jeu importé le 2026-10-11");
  });
  it("sert encore le dernier import réussi après échec et montre la fraîcheur dans Réglages", async () => {
    state.execute.mockResolvedValue({ rows: [{ ...dbRow, last_status: "failed" }] });
    expect((await hatvp.bySiren("552081317")).raw).toEqual(data);
    expect(importFreshness([{ source: "hatvp", status: "ok", imported_at: data.importedAt, checked_at: data.importedAt, record_count: 3773, last_status: "failed" }], "ready").find(r => r.source === "hatvp"))
      .toMatchObject({ label: "Répertoire HATVP", state: "ok", recordCount: 3773, lastAttemptFailed: true });
  });
  it("dégrade les schémas inattendus et toute ligne d'un autre SIREN", async () => {
    for (const row of [{ ...dbRow, imported_at: "invalid" }, { ...dbRow, organisation: { ...organisation, siren: "356000000" } },
      { ...dbRow, organisation: { ...organisation, categoryLabel: "IDENTITE_INTERDITE" } }, { ...dbRow, organisation: {} }]) {
      state.execute.mockResolvedValue({ rows: [row] }); const r = await hatvp.bySiren("552081317");
      expect(isDegradedEndpoint(r.endpoint)).toBe(true); expect(hatvpAttributes(r.raw)).toEqual({});
    }
  });
  it("rend les dates, cessation, inconnus et zéros sans jugement ni exercice clos inventé", () => {
    const text = hatvpAttributes(data)["Répertoire HATVP"];
    expect(text).toContain("depuis 2020"); expect(text).toContain("0 activité(s) déclarée(s)");
    expect(text).toContain("exercice se terminant le 31/12/2026"); expect(text).not.toContain("exercice clos");
    expect(text).toContain("https://www.hatvp.fr/fiche-organisation/?organisation=552081317");
    expect(text).not.toMatch(/fraude|sanction|infraction|suspect/i);
    expect(hatvpAttributes({ ...data, organisation: { ...organisation, ceasedOn: "2025-03-12", deregistrationReason: "CESSATION" } })["Répertoire HATVP"]).toContain("Désinscrite le 12/03/2025 (cessation)");
    expect(hatvpAttributes({ ...data, organisation: { ...organisation, activitiesPublished: null, activityCountLast: null } })["Répertoire HATVP"]).toContain("volume non renseigné");
    for (const raw of [null, 3, [], {}, { ...data, organisation: { ...organisation, ceasedOn: "2025-02-31" } }]) expect(hatvpAttributes(raw)).toEqual({});
    expect(JSON.stringify(hatvpAttributes({ ...data, denomination: "IDENTITE_INTERDITE", organisation: { ...organisation, nomUsage: "IDENTITE_INTERDITE" } }))).not.toContain("IDENTITE_INTERDITE");
  });
});
