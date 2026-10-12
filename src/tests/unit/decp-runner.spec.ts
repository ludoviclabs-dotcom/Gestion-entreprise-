import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
const state = vi.hoisted(() => ({ events: [] as string[], fail: false, written: 0 }));
vi.mock("../../../scripts/import/lib/stream", async () => ({ ...await vi.importActual("../../../scripts/import/lib/stream"),
  download: async (url: string) => {
    state.events.push("download");
    if (state.fail) throw Error("PRIVATE_ERROR_MARKER");
    if (url.includes("/api/1/")) return Readable.from([Buffer.from(JSON.stringify({ resources: Array.from({ length: 13 }, (_, i) => {
      const d = new Date("2025-10-01"); d.setUTCMonth(d.getUTCMonth() + i); const month = d.toISOString().slice(0, 7);
      return { title: `decp-${month}.json`, url: `https://static.data.gouv.fr/resources/donnees-essentielles-de-la-commande-publique-fichiers-consolides/20261004-182636/decp-${month}.json` };
    }) }))]);
    return Readable.from([Buffer.from(JSON.stringify({ marches: { marche: Array.from({ length: 100 }, (_, i) => ({
      id: `2026-${i}`, acheteur: { id: "55208131700001" }, codeCPV: "45000000", objet: "EQUIPEMENT TEST",
      dateNotification: "2026-09-01", datePublicationDonnees: "2026-10-01", montant: 100,
      titulaires: [{ titulaire: { id: "35600000000002", typeIdentifiant: "SIRET" } }],
    })) } }))]);
  },
}));
vi.mock("../../../scripts/import/lib/postgres-store", () => ({ postgresImportStore: () => ({
  transaction: async (_identity: unknown, work: (tx: unknown) => Promise<unknown>) => {
    state.events.push("transaction");
    try { return await work({ write: async (rows: unknown[]) => { state.written += rows.length; }, count: async () => state.written, publish: async () => false }); }
    catch (e) { state.events.push("failed"); throw e; }
  },
}) }));
import { importDecp } from "../../../scripts/import/decp";
beforeEach(() => { state.events = []; state.fail = false; state.written = 0; });
describe("DECP préparation et publication", () => {
  it("prépare les treize fichiers avant la transaction, puis publie les seules synthèses", async () => {
    const r = await importDecp({} as never, new Date("2026-10-12T12:00:00Z"));
    expect(state.events.filter(e => e === "download")).toHaveLength(14);
    expect(state.events.indexOf("transaction")).toBe(14);
    expect(r.recordCount).toBe(2); expect(r.stats.retained).toBe(100);
    expect(r.stats.files).toHaveLength(13); expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("un échec amont enregistre une tentative en échec, sans données ni erreur privée", async () => {
    state.fail = true;
    await expect(importDecp({} as never, new Date("2026-10-12T12:00:00Z"))).rejects.toThrow("IMPORT_FAILED_PREVIOUS_DATA_PRESERVED");
    expect(state.events).toEqual(["download", "transaction", "failed"]); expect(state.written).toBe(0);
  });
});
