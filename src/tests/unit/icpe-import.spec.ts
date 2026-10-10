import { describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import { icpeInput, projectIcpe, icpeWriter } from "../../../scripts/import/icpe";
const site = (id: string, over: Record<string, unknown> = {}) => ({ codeAIOT: id, siret: "55208131700000", raisonSociale: "SITE PRO",
  commune: "LYON", regime: "Autorisation", ied: true, prioriteNationale: false, statutSeveso: "Non Seveso", codeNaf: "35.11Z",
  inspections: [{ dateInspection: "2026-01-01", rapport: "PRIVE" }], etatActivite: "En exploitation avec titre", ...over });
const page = (n: number, data: unknown[], total = 3) => ({ results: total, page: n, total_pages: Math.ceil(total / 2), data,
  next: n < Math.ceil(total / 2) ? "http://untrusted.invalid/secret" : null });
const stream = (v: unknown) => Readable.from([Buffer.from(JSON.stringify(v))]);
async function consume(values: unknown[]) {
  const read = vi.fn(async (n: number) => stream(values[n - 1]));
  const input = icpeInput(read, { pageSize: 2, minimumRecords: 1 });
  const rows = [];
  for await (const r of input.rows) rows.push(r);
  return { rows, stats: input.stats, hash: input.fingerprint(), read };
}
describe("import ICPE national", () => {
  it("consomme toutes les pages dans l'ordre sans suivre next et garde plusieurs sites d'un SIRET", async () => {
    const r = await consume([page(1, [site("a"), site("b")]), page(2, [site("c")])]);
    expect(r.rows).toHaveLength(3);
    expect(r.read.mock.calls).toEqual([[1, 2], [2, 2]]);
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.stats.received).toBe(3);
  });
  it("exclut Non ICPE et les identifiants inexploitables, conserve les EI et minimise les champs", async () => {
    const r = await consume([page(1, [site("a", { regime: "Non ICPE" }), site("b", { siret: "invalide" })]),
      page(2, [site("c", { categorieJuridique: "1000", adresse1: "PRIVEE", telephone: "CONTACT", rubriques: ["VOLUMINEUX"], inspections: [{ dateInspection: "2025-12-31", rapport: "PRIVE" }, { dateInspection: "2026-01-01" }] })])]);
    expect(r.rows).toHaveLength(1);
    expect(r.stats).toEqual({ received: 3, nonIcpe: 1, unusableIdentifier: 1 });
    expect(r.rows[0]).toMatchObject({ siren: "552081317", inspections: 2, last_inspection: "2026-01-01" });
    expect(JSON.stringify(r.rows)).not.toMatch(/PRIVEE|CONTACT|VOLUMINEUX|PRIVE|rapport|adresse/);
  });
  it("refuse les changements de total, numéros/pages manquantes et pages tronquées", async () => {
    for (const second of [page(1, [site("c")]), page(2, []), page(2, [site("c")], 4), { ...page(2, [site("c")]), total_pages: 3 }, { ...page(2, [site("c")]), next: "encore" }]) {
      await expect(consume([page(1, [site("a"), site("b")]), second])).rejects.toThrow();
    }
    await expect(consume([{ ...page(1, [site("a"), site("b")]), next: null }])).rejects.toThrow();
    await expect(consume([{ ...page(1, []), results: 0, total_pages: 0 }])).rejects.toThrow();
  });
  it("détecte les doublons entre pages et les identifiants naturels absents", async () => {
    await expect(consume([page(1, [site("a"), site("b")]), page(2, [site("a")])])).rejects.toThrow("ICPE_DUPLICATE_OR_MISSING_ID");
    await expect(consume([page(1, [site(""), site("b")])])).rejects.toThrow();
  });
  it("ne finalise jamais un flux interrompu ou une page non JSON", async () => {
    const input = icpeInput(async n => n === 1 ? stream(page(1, [site("a"), site("b")])) : Readable.from([Buffer.from("<html>panne</html>")]), { pageSize: 2, minimumRecords: 1 });
    await expect((async () => { for await (const r of input.rows) void r; })()).rejects.toThrow();
    expect(() => input.fingerprint()).toThrow();
    const cut = icpeInput(async () => stream(page(1, [site("a"), site("b")])), { pageSize: 2, minimumRecords: 1 });
    for await (const r of cut.rows) { expect(r.siren).toBe("552081317"); break; }
    expect(() => cut.fingerprint()).toThrow();
  });
  it("refuse les dates et booléens illisibles sans inventer une valeur", () => {
    const stats = { received: 0, nonIcpe: 0, unusableIdentifier: 0 };
    expect(() => projectIcpe(site("a", { inspections: [{ dateInspection: "2026-02-31" }] }), stats)).toThrow();
    expect(() => projectIcpe(site("a", { ied: "unknown" }), stats)).toThrow();
    expect(projectIcpe(site("a", { ied: null, inspections: null }), stats)).toMatchObject({ ied: null, inspections: 0, last_inspection: null });
    for (const siret of ["00000000000000", "55208131800000", "55208131700000' OR true", "552081317"]) expect(projectIcpe(site("a", { siret }), stats)).toBeNull();
  });
  it("borne chaque page et refuse une panne réseau", async () => {
    const oversized = icpeInput(async () => Readable.from([Buffer.alloc(32 * 1024 * 1024 + 1)]));
    await expect((async () => { for await (const r of oversized.rows) void r; })()).rejects.toThrow("ICPE_PAGE_TOO_LARGE");
    const broken = icpeInput(async () => { throw new Error("network"); });
    await expect((async () => { for await (const r of broken.rows) void r; })()).rejects.toThrow();
    expect(() => broken.fingerprint()).toThrow();
  });
  it("upsert par code AIOT, sans fusionner les sites d'un même établissement", async () => {
    let values: unknown, query = "";
    const tx = (first: unknown) => { if (Array.isArray(first) && "raw" in first) { query = first.join("?"); return Promise.resolve([]); } values = first; return "values"; };
    const stats = { received: 0, nonIcpe: 0, unusableIdentifier: 0 };
    const a = projectIcpe(site("a"), stats)!, b = projectIcpe(site("b"), stats)!;
    await icpeWriter.write(tx as never, "import", [a, a, b]);
    expect(values).toHaveLength(2);
    expect(query).toContain("on conflict (import_id, code_aiot) do update");
  });
});
