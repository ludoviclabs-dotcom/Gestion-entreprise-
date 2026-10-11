import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { projectDecp, decpSummaries, type DecpFileStats } from "../../../scripts/import/decp";
const state = vi.hoisted(() => ({ db: null as unknown as PGlite, demo: false, enabled: true, fail: false, calls: 0 }));
vi.mock("@/lib/env", () => ({ isDemoMode: () => state.demo, isDecpEnabled: () => state.enabled }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ execute: async (q: SQL) => {
  state.calls++; if (state.fail) throw Error("PRIVATE_SECRET_MARKER");
  const query = new PgDialect().sqlToQuery(q); return state.db.query(query.sql, query.params);
} }) }));
import { decp } from "@/lib/connectors/decp";
import { decpAttributes, normalizeDecp } from "@/lib/ingestion/normalize-decp";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import type { DecpRaw } from "@/lib/ingestion/decp-data";
const window = { start: "2025-10-12", end: "2026-10-12" };
const stats = (): DecpFileStats => ({ month: "2026-10", read: 0, inWindow: 0, outsideWindow: 0, invalidNotificationDate: 0,
  attributions: 0, nonSiret: 0, invalidSiren: 0, invalidBuyer: 0, invalidIdentity: 0, modifications: 0, bytes: 0, sha256: "", seconds: 0 });
const market = (id: string, holders = ["35600000000002"], amount: unknown = 1000, extra = {}) => ({ id, acheteur: { id: "55208131700001" },
  codeCPV: "45000000-7", objet: "EQUIPEMENT TEST", dateNotification: "2026-09-01", datePublicationDonnees: "2026-10-01", montant: amount,
  titulaires: holders.map(id => ({ titulaire: { id, typeIdentifiant: "SIRET" } })), ...extra });
beforeAll(async () => {
  state.db = new PGlite(); await state.db.exec("create type source_kind as enum ('sirene','manual');");
  for (const name of ["0014_open_data_imports.sql", "0021_decp_summaries.sql", "0021_decp_summaries.sql"])
    await state.db.exec(readFileSync(`drizzle/${name}`, "utf8").replace(/--> statement-breakpoint/g, ""));
});
afterAll(async () => { await state.db.close(); });
beforeEach(async () => { state.demo = false; state.enabled = true; state.fail = false; state.calls = 0; await state.db.exec("delete from open_data_imports;"); });
async function seed(markets: unknown[], status = "ok", when = "2026-10-12T12:00:00Z") {
  const id = crypto.randomUUID();
  await state.db.query(`insert into open_data_imports(id,source,version,source_url,status,sha256,record_count,imported_at,started_at,checked_at)
    values($1,'decp','decp-v1','https://source.test',$2,$3,$4,$5,$6,$6)`, [id, status, "a".repeat(64), markets.length, status === "ok" ? when : null, when]);
  if (status !== "ok") return id;
  await state.db.query("insert into decp_windows values($1,$2,$3,'2026-10')", [id, window.start, window.end]);
  const cols = "siren text,role text,total int,reliable_amount numeric,single_reliable int,grouped int,unreliable int,last_notified date,buyers jsonb,items jsonb";
  const rows = markets.flatMap(m => projectDecp(m, "2026-10", window, stats())), summaries = [];
  for await (const summary of decpSummaries((async function* () { yield* rows; })())) summaries.push(summary);
  if (summaries.length) await state.db.query(`insert into decp_summaries(import_id,${cols.split(",").map(c => c.split(" ")[0]).join(",")})
    select $1,x.* from jsonb_to_recordset($2::jsonb) as x(${cols})`, [id, JSON.stringify(summaries)]);
  return id;
}
describe("DECP — requête réelle sur PostgreSQL et migrations 0014/0021", () => {
  it("enum idempotent, avant manual, FK avec cascade", async () => {
    const enums = await state.db.query<{ enumlabel: string }>("select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='source_kind' order by e.enumsortorder");
    expect(enums.rows.map(r => r.enumlabel)).toEqual(["sirene", "decp", "manual"]);
    const id = await seed([market("a")]); await state.db.query("delete from open_data_imports where id=$1", [id]);
    expect((await state.db.query("select * from decp_summaries")).rows).toEqual([]);
    expect((await state.db.query("select * from decp_windows")).rows).toEqual([]);
  });
  it("retrouve chaque co-titulaire ; même SIREN par deux NIC = un marché, aucun montant réparti", async () => {
    await seed([market("single"), market("group", ["35600000000002", "35600000000003", "34326262200001"], 9000),
      market("bad-amount", undefined, 999999999), market("reused", undefined, 200, { objet: "OBJET A" }),
      market("reused", undefined, 300, { objet: "OBJET B" })]);
    const r = await decp.bySiren("356000000"), d = r.raw as DecpRaw;
    expect(r.httpStatus).toBe(200); expect(state.calls).toBe(1);
    expect(d.holder).toMatchObject({ total: 5, grouped: 1, unreliable: 1, singleReliable: 3, reliableAmount: 1500 });
    const other = (await decp.bySiren("343262622")).raw as DecpRaw;
    expect(other.holder).toMatchObject({ total: 1, grouped: 1, reliableAmount: 0 });
    const buyer = (await decp.bySiren("552081317")).raw as DecpRaw;
    expect(buyer.buyer).toMatchObject({ total: 5, grouped: 1, reliableAmount: 1500 });
    expect(decpAttributes(d)["Marchés publics attribués (DECP)"]).toContain("montant non réparti");
  });
  it("totaux complets, liste plafonnée à 20 et 5 acheteurs ; événements datés sans jugement", async () => {
    await seed(Array.from({ length: 31 }, (_, i) => market(`m-${i}`, undefined, 100)));
    const r = await decp.bySiren("356000000"), d = r.raw as DecpRaw;
    expect(d.holder.total).toBe(31); expect(d.holder.reliableAmount).toBe(3100); expect(d.holder.items).toHaveLength(20);
    const events = normalizeDecp(d, "co:356000000"); expect(events).toHaveLength(20);
    expect(events.every(e => e.kind === "marche_public_attribue" && e.evidenceLevel === "declared" && e.occurredOn === "2026-09-01")).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/PRIVATE_|fraude|sanction|infraction/i);
    expect(decpAttributes(d)["Marchés publics attribués (DECP)"]).toContain("modifications non exploitées");
  });
  it("absent, jamais importé et première tentative en échec sont trois états distincts", async () => {
    const missing = await decp.bySiren("356000000"); expect(missing.endpoint).toContain("(source non importée)"); expect(decpAttributes(missing.raw)).toEqual({});
    await seed([], "failed"); const failed = await decp.bySiren("356000000"); expect(failed.endpoint).toContain("(exception)");
    await state.db.exec("delete from open_data_imports;"); await seed([market("a")]);
    const absent = await decp.bySiren("123456782"); expect(absent.httpStatus).toBe(200);
    expect(decpAttributes(absent.raw)["Marchés publics attribués (DECP)"]).toContain("Aucun marché notifié sur la fenêtre importée");
    expect(decpAttributes(absent.raw)["Marchés publics attribués (DECP)"]).toContain(window.start);
  });
  it("un échec de rafraîchissement conserve le dernier succès et un rollback conserve toutes ses lignes", async () => {
    await seed([market("old")]);
    await expect(state.db.transaction(async tx => { await tx.exec("delete from decp_summaries;"); throw Error("INTERRUPTED"); })).rejects.toThrow();
    await seed([], "failed", "2026-10-13T12:00:00Z");
    const r = await decp.bySiren("356000000"); expect((r.raw as DecpRaw).holder.total).toBe(1);
  });
  it("fixture/sentinelle avant tout appel ; injection invalide et panne sans secret", async () => {
    state.demo = true; expect((await decp.bySiren("356000000")).endpoint).toBe("fixture:decp");
    state.demo = false; state.enabled = false; expect((await decp.bySiren("356000000")).isFixture).toBe(true);
    state.enabled = true;
    for (const s of ["000000000", "356000001", "356000000' OR true"]) {
      const r = await decp.bySiren(s); expect(r.httpStatus).toBe(400); expect(r.endpoint).not.toMatch(/^db:|^https:/); expect(isDegradedEndpoint(r.endpoint)).toBe(true);
    }
    expect(state.calls).toBe(0); state.fail = true; const r = await decp.bySiren("356000000");
    expect(r.endpoint).toBe("db:decp_summaries?siren=356000000 (exception)"); expect(JSON.stringify(r)).not.toContain("PRIVATE_SECRET");
  });
});
