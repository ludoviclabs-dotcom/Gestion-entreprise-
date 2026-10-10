import { describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { batches, Fingerprint, download } from "../../../scripts/import/lib/stream";
import { runImport, type ImportStore, type ImportIdentity, type ImportTransaction } from "../../../scripts/import/lib/runner";
import { connectImportDatabase } from "../../../scripts/import/lib/postgres-store";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import { getSourceHealth } from "@/lib/data/case-quality";
import { importFreshness } from "@/lib/data/import-freshness";

const identity: ImportIdentity = { source: "sample", version: "sample-v1", sourceUrl: "https://example.org/sample.csv" };
const sha = "a".repeat(64);
async function* sequence(count: number) { for (let i = 0; i < count; i++) yield i; }

/** Store transactionnel de contrat : les données servies ne changent qu'au commit. */
function memoryStore() {
  let published = [99];
  let fingerprint = "old";
  const sizes: number[] = [];
  const store: ImportStore<number> = {
    async transaction<R>(_identity: ImportIdentity, work: (tx: ImportTransaction<number>) => Promise<R>) {
      const staging: number[] = [];
      const before = [...published];
      let nextFingerprint = fingerprint;
      const result = await work({
        write: async (rows) => { sizes.push(rows.length); staging.push(...rows); expect(published).toEqual(before); },
        count: async () => new Set(staging).size,
        publish: async (value) => { nextFingerprint = value; return value === fingerprint; },
      });
      if (nextFingerprint !== fingerprint) published = [...new Set(staging)];
      fingerprint = nextFingerprint;
      return result;
    },
  };
  return { store, sizes, rows: () => published };
}

describe("socle des imports", () => {
  it("écrit des lots bornés et publie après la consommation complète", async () => {
    const db = memoryStore();
    const result = await runImport(identity, async () => ({ rows: sequence(1001), fingerprint: () => sha }), db.store);
    expect(db.sizes).toEqual([500, 500, 1]);
    expect(result).toMatchObject({ recordCount: 1001, unchanged: false });
    expect(db.rows()).toHaveLength(1001);
  });
  it("ne remplace jamais les données servies si le flux est interrompu après un lot", async () => {
    const db = memoryStore();
    async function* broken() { yield* sequence(501); throw new Error("network"); }
    await expect(runImport(identity, async () => ({ rows: broken(), fingerprint: () => sha }), db.store)).rejects.toThrow("network");
    expect(db.sizes).toEqual([500]);
    expect(db.rows()).toEqual([99]);
  });
  it("rejoue le même import sans dupliquer les données", async () => {
    const db = memoryStore();
    const open = async () => ({ rows: sequence(10), fingerprint: () => sha });
    await runImport(identity, open, db.store);
    expect(await runImport(identity, open, db.store)).toMatchObject({ unchanged: true, recordCount: 10 });
    expect(db.rows()).toEqual(Array.from({ length: 10 }, (_, i) => i));
  });
  it("refuse une empreinte invalide ou une source vide", async () => {
    const db = memoryStore();
    await expect(runImport(identity, async () => ({ rows: sequence(1), fingerprint: () => "" }), db.store)).rejects.toThrow("INVALID_FINGERPRINT");
    await expect(runImport(identity, async () => ({ rows: sequence(0), fingerprint: () => sha }), db.store)).rejects.toThrow("EMPTY_IMPORT");
    expect(db.rows()).toEqual([99]);
  });
  it("attend l'écriture avant de poursuivre la lecture (backpressure)", async () => {
    let produced = 0;
    async function* input() { for (let i = 0; i < 6; i++) { produced++; yield i; } }
    const iterator = batches(input(), 2);
    expect((await iterator.next()).value).toEqual([0, 1]);
    expect(produced).toBe(2);
    expect((await iterator.next()).value).toEqual([2, 3]);
    expect(produced).toBe(4);
    await iterator.return(undefined);
  });
  it.each([0, -1, 1.5, 1001])("refuse une taille de lot invalide (%s)", async (size) => {
    await expect(batches(sequence(1), size).next()).rejects.toThrow("INVALID_BATCH_SIZE");
  });
  it("calcule le SHA en flux sans dépendre du découpage réseau", async () => {
    const fp = new Fingerprint(100);
    for await (const _ of fp.measure(Readable.from([Buffer.from("abc"), Buffer.from("def")]))) { void _; }
    expect(fp.bytes).toBe(6);
    expect(fp.finish()).toBe(createHash("sha256").update("abcdef").digest("hex"));
    expect(() => fp.finish()).toThrow("INCOMPLETE_SOURCE");
  });
  it("refuse de valider un flux interrompu même si des octets ont été lus", async () => {
    const fp = new Fingerprint(100);
    const iterator = fp.measure(Readable.from([Buffer.from("abc"), Buffer.from("def")]));
    await iterator.next();
    expect(() => fp.finish()).toThrow("INCOMPLETE_SOURCE");
    await iterator.return(undefined);
    expect(() => fp.finish()).toThrow("INCOMPLETE_SOURCE");
  });
  it("coupe un fichier trop gros avant publication", async () => {
    const fp = new Fingerprint(3);
    await expect(async () => { for await (const _ of fp.measure(Readable.from([Buffer.from("abcd")]))) { void _; } }).rejects.toThrow("SOURCE_TOO_LARGE");
  });
  it("échoue sur HTTP 5xx et refuse une URL qui pourrait embarquer un secret", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("failure", { status: 503 }));
    try {
      await expect(download("https://example.org/source", AbortSignal.timeout(100))).rejects.toThrow("SOURCE_HTTP_ERROR");
      await expect(download("https://user:password@example.org/source", AbortSignal.timeout(100))).rejects.toThrow("INVALID_SOURCE_URL");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    } finally { fetcher.mockRestore(); }
  });
  it("ne charge pas de secret depuis .env.local et exige une connexion directe", () => {
    const old = process.env.DATABASE_URL_UNPOOLED;
    try {
      delete process.env.DATABASE_URL_UNPOOLED;
      expect(connectImportDatabase).toThrow("DATABASE_SECRET_REQUIRED");
      process.env.DATABASE_URL_UNPOOLED = "postgres://user:secret@ep-test-pooler.neon.tech/db";
      expect(connectImportDatabase).toThrow("DIRECT_DATABASE_CONNECTION_REQUIRED");
      process.env.DATABASE_URL_UNPOOLED = "not a url";
      expect(connectImportDatabase).toThrow("DATABASE_SECRET_INVALID");
    } finally {
      if (old === undefined) delete process.env.DATABASE_URL_UNPOOLED;
      else process.env.DATABASE_URL_UNPOOLED = old;
    }
  });
  it("compte source non importée comme échec, même sous HTTP 200", () => {
    const endpoint = "db:icpe_sites?siren=552081317 (source non importée)";
    expect(isDegradedEndpoint(endpoint)).toBe(true);
    expect(getSourceHealth([{ source: "georisques", endpoint, httpStatus: 200, isFixture: false }]).failed).toBe(1);
    expect(isDegradedEndpoint("db:icpe_sites?siren=552081317")).toBe(false);
  });
  it("distingue sans base, non importé et état inaccessible", () => {
    expect(importFreshness([], "unconfigured").every((x) => x.state === "unconfigured")).toBe(true);
    expect(importFreshness([], "unavailable").every((x) => x.state === "unavailable")).toBe(true);
    expect(importFreshness([], "ready").every((x) => x.state === "missing")).toBe(true);
  });
  it("affiche encore la fraîcheur réussie après un échec", () => {
    expect(importFreshness([{ source: "camino", status: "ok", imported_at: "2026-10-01", checked_at: "2026-10-02", record_count: 30, last_status: "failed" }], "ready")[0])
      .toMatchObject({ state: "ok", recordCount: 30, lastAttemptFailed: true, importedAt: "2026-10-01T00:00:00.000Z" });
  });
});
