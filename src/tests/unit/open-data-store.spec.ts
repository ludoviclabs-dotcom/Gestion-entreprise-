import { describe, it, expect } from "vitest";
import type { Sql, TransactionSql } from "postgres";
import { postgresImportStore, type DatasetWriter } from "../../../scripts/import/lib/postgres-store";
import { runImport } from "../../../scripts/import/lib/runner";

const identity = { source: "sample", version: "v1", sourceUrl: "https://example.org/data" };
const sha = "a".repeat(64);
function harness(previous: { id: string; sha256: string; version: string }[] = [], fail = false) {
  const calls: { query: string; values: unknown[] }[] = [];
  const events: string[] = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const text = parts.join("?").replace(/\s+/g, " ").trim();
    calls.push({ query: text, values });
    if (text.startsWith("select id, sha256")) return previous;
    return [];
  };
  const tx = query as unknown as TransactionSql;
  const db = Object.assign(query, {
    begin: async (work: (transaction: TransactionSql) => Promise<unknown>) => {
      events.push("begin");
      try { const result = await work(tx); events.push("commit"); return result; }
      catch (error) { events.push("rollback"); throw error; }
    },
  }) as unknown as Sql;
  const writer: DatasetWriter<number> = {
    write: async (transaction, _id, rows) => {
      expect(transaction).toBe(tx);
      events.push("write:" + rows.length);
      if (fail) throw new Error("secret-database-error");
    },
    count: async () => 1,
    prune: async (_tx, id) => { expect(id).toBe(calls.find(c => c.query.startsWith("insert"))?.values[0]); events.push("prune"); },
  };
  return { store: postgresImportStore(db, writer), calls, events };
}
async function* rows() { yield 1; }
const open = async () => ({ rows: rows(), fingerprint: () => sha });

describe("publication Postgres des imports", () => {
  it("prend le verrou et publie avant purge et commit", async () => {
    const h = harness();
    expect(await runImport(identity, open, h.store)).toMatchObject({ unchanged: false });
    expect(h.events).toEqual(["begin", "write:1", "prune", "commit"]);
    expect(h.calls[2].query).toContain("pg_advisory_xact_lock");
    expect(h.calls[2].values).toEqual(["sample"]);
    expect(h.calls.find(c => c.query.includes("set status = 'ok'"))?.values).toContain(sha);
    expect(h.calls.some(c => c.query.includes("'failed'"))).toBe(false);
  });
  it("même empreinte et projection : conserve la version publiée", async () => {
    const h = harness([{ id: "previous", sha256: sha, version: "v1" }]);
    expect(await runImport(identity, open, h.store)).toMatchObject({ unchanged: true });
    expect(h.events).not.toContain("prune");
    expect(h.calls.some(c => c.query.startsWith("delete from open_data_imports"))).toBe(true);
    expect(h.calls.find(c => c.query.includes("set checked_at"))?.values).toEqual(["previous"]);
  });
  it("une projection différente impose une nouvelle publication", async () => {
    const h = harness([{ id: "previous", sha256: sha, version: "v0" }]);
    expect(await runImport(identity, open, h.store)).toMatchObject({ unchanged: false });
    expect(h.events).toContain("prune");
  });
  it("enregistre seulement l'échec après rollback sans divulguer l'erreur", async () => {
    const h = harness([], true);
    await expect(runImport(identity, open, h.store)).rejects.toThrow("IMPORT_FAILED_PREVIOUS_DATA_PRESERVED");
    expect(h.events).toEqual(["begin", "write:1", "rollback"]);
    expect(h.calls.at(-1)?.query).toContain("'failed'");
    expect(JSON.stringify(h.calls)).not.toContain("secret-database-error");
    expect(h.calls.some(c => c.query.includes("set status = 'ok'"))).toBe(false);
  });
});
