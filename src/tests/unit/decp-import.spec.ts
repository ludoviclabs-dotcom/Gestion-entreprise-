import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import postgres from "postgres";
import { decpInput, decpResources, decpWindow, decpWriter, decpSummaries, normalizeCpv, projectDecp, type DecpFileStats } from "../../../scripts/import/decp";
import { runImport } from "../../../scripts/import/lib/runner";
import { GROUPS, sourcesFor } from "../../../scripts/import/lib/groups";

const window = { start: "2025-10-12", end: "2026-10-12" };
const limits = { minimum: 1, maxFileBytes: 100000, maxTotalBytes: 200000, maxRows: 100 };
const stats = (): DecpFileStats => ({ month: "2026-10", read: 0, inWindow: 0, outsideWindow: 0, invalidNotificationDate: 0,
  attributions: 0, nonSiret: 0, invalidSiren: 0, invalidBuyer: 0, invalidIdentity: 0, modifications: 0, bytes: 0, sha256: "", seconds: 0 });
const market = (overrides: Record<string, unknown> = {}) => ({
  id: "2026-001", acheteur: { id: "55208131700001", nom: "PRIVATE_BUYER_MARKER" }, codeCPV: "33600000-6",
  objet: "ÉQUIPEMENT   MÉDICAL", dateNotification: "2026-09-01", datePublicationDonnees: "2026-10-01",
  montant: 1000, nature: "Marché", procedure: "Procédure adaptée", source: "aife",
  titulaires: [{ titulaire: { typeIdentifiant: "SIRET", id: "35600000000002", denominationSociale: "PRIVATE_HOLDER_MARKER" } }],
  ...overrides,
});
const doc = (rows: unknown[]) => JSON.stringify({ marches: { marche: rows } });
const input = (rows: unknown[], opts = limits) => decpInput([{ month: "2026-10", url: "https://source.test" }], async () => Readable.from([doc(rows)]), window, opts);
async function collect(i: ReturnType<typeof input>) { const rows = []; for await (const r of i.rows) rows.push(r); return rows; }

describe("DECP projection des vraies formes de champs", () => {
  it("rapproche le SIREN de La Poste et un NIC malformé sans Luhn du SIRET complet", () => {
    const s = stats(), rows = projectDecp(market({ titulaires: [
      { titulaire: { typeIdentifiant: "SIRET", id: "35600000000002" } },
      { titulaire: { typeIdentifiant: "SIRET", id: "40149482840149" } },
      { titulaire: { typeIdentifiant: "TVA", id: "FR123" } },
      { titulaire: { typeIdentifiant: "SIRET", id: "00000000000000" } },
      { titulaire: { typeIdentifiant: "SIRET", id: "55208131800001" } },
    ] }), "2026-10", window, s);
    expect(rows.map(r => r.titulaire_siren)).toEqual(["356000000", "401494828"]);
    expect(rows.every(r => r.holder_count === 5)).toBe(true);
    expect(s).toMatchObject({ nonSiret: 1, invalidSiren: 2 });
  });
  it("ne projette aucun nom, contact, objet ou identifiant libre nominatif", async () => {
    const privateText = "PRIVATE_PERSON_MARKER";
    const i = input([market({ id: privateText, objet: privateText, nature: privateText, procedure: privateText, source: privateText,
      email: "PRIVATE_EMAIL_MARKER", contact: privateText, adresse: "PRIVATE_ADDRESS_MARKER", modifications: [{ modification: { objet: privateText } }] })]);
    const rows = await collect(i);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(/PRIVATE_|denomination|email|adresse|objet":/);
    expect(rows[0].marche_id).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].objet_hash).toMatch(/^[a-f0-9]{12}$/);
    expect(rows[0]).toMatchObject({ nature: null, procedure: null, source: null });
    expect(i.stats.files[0].modifications).toBe(1);
  });
  it("normalise CPV et objet sans fusionner des objets distincts pour un identifiant réutilisé", async () => {
    expect(["45", "33600000-6", "123456789", "PRIVATE_MARKER"].map(normalizeCpv)).toEqual(["45000000", "33600000", "12345678", null]);
    const rows = await collect(input([market(), market({ codeCPV: "33600000", objet: "equipement medical" }), market({ objet: "AUTRE EQUIPEMENT" })]));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(r => r.objet_hash)).size).toBe(2);
  });
  it("applique les bornes inclusives à la notification, pas au mois du fichier", () => {
    const s = stats();
    for (const date of [window.start, window.end, "2025-10-11", "2026-10-13", "0206-01-01", "2026-02-31", "illisible"])
      projectDecp(market({ dateNotification: date }), "2026-10", window, s);
    expect(s).toMatchObject({ read: 7, inWindow: 2, outsideWindow: 1, invalidNotificationDate: 4 });
    expect(decpWindow(new Date("2024-02-29T12:00:00Z"))).toEqual({ start: "2023-02-28", end: "2024-02-29" });
  });
  it("conserve mais marque les montants non fiables sans les transformer en zéro", () => {
    for (const amount of [0, -1, 999999999, "1000", null]) {
      const rows = projectDecp(market({ montant: amount }), "2026-10", window, stats());
      expect(rows).toHaveLength(1); expect(rows[0].amount_unreliable).toBe(true);
    }
    expect(projectDecp(market(), "2026-10", window, stats())[0].amount_unreliable).toBe(false);
  });
  it("refuse le mauvais schéma et conserve le titulaire quand le SIREN acheteur est inexploitable", () => {
    expect(() => projectDecp({ dateNotification: "2026-01-01", titulaires: {} }, "2026-10", window, stats())).toThrow("DECP_MARKET_SCHEMA");
    const s = stats(); expect(projectDecp(market({ acheteur: { id: "55208131800001" } }), "2026-10", window, s)[0].acheteur_siren).toBeNull();
    expect(s.invalidBuyer).toBe(1);
  });
});

describe("DECP flux, catalogue, atomique et idempotence", () => {
  it("les totaux précèdent le plafond de 20 et gardent les montants sous le centime sans bruit binaire", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => projectDecp(market({ id: `m-${i}`, montant: i === 0 ? 0.1 : i === 1 ? 0.2 : 0.001 }), "2026-10", window, stats())[0]);
    const summaries = [];
    for await (const s of decpSummaries((async function* () { yield* rows; })())) summaries.push(s);
    const holder = summaries.find(s => s.role === "holder")!;
    expect(holder.total).toBe(25); expect(holder.single_reliable).toBe(25); expect(holder.items).toHaveLength(20);
    expect(holder.reliable_amount).toBe(0.323); expect(holder.buyers[0].count).toBe(25);
  });
  it("fusionne les republications entre fichiers par publication, puis par fichier si non renseignée", async () => {
    const files = [{ month: "2026-09", url: "one" }, { month: "2026-10", url: "two" }];
    const i = decpInput(files, async f => Readable.from([doc([market({ montant: f.month === "2026-09" ? 20 : 40,
      datePublicationDonnees: f.month === "2026-09" ? "2026-09-10" : "2026-09-01" })])]), window, limits);
    expect((await collect(i))[0].amount).toBe(20); expect(i.stats.duplicates).toBe(1);
    const j = decpInput(files, async f => Readable.from([doc([market({ montant: f.month === "2026-09" ? 20 : 40, datePublicationDonnees: null })])]), window, limits);
    expect((await collect(j))[0].amount).toBe(40);
  });
  it("ne fusionne pas les co-titulaires, même quand ils ont le même SIREN", async () => {
    const rows = await collect(input([market({ titulaires: [{ titulaire: { typeIdentifiant: "SIRET", id: "35600000000002" } },
      { titulaire: { typeIdentifiant: "SIRET", id: "35600000000003" } }] })]));
    expect(rows).toHaveLength(2); expect(rows.every(r => r.holder_count === 2 && r.amount === 1000)).toBe(true);
  });
  it("refuse vide, tronqué, trop volumineux, trop de lignes et conserve la fenêtre précédente en cas de coupure", async () => {
    for (const source of ["{}", doc([]), doc([market()]).slice(0, -3)]) {
      const i = decpInput([{ month: "2026-10", url: "x" }], async () => Readable.from([source]), window, limits);
      await expect(collect(i)).rejects.toThrow(); expect(() => i.fingerprint()).toThrow("DECP_INCOMPLETE_SOURCE");
    }
    await expect(collect(input([market()], { ...limits, maxFileBytes: 20 }))).rejects.toThrow();
    await expect(collect(input([market(), market({ id: "another" })], { ...limits, maxRows: 1 }))).rejects.toThrow();
    let published = false, written = false;
    const files = [{ month: "2026-09", url: "one" }, { month: "2026-10", url: "two" }];
    await expect(runImport({ source: "decp", version: "decp-v1", sourceUrl: "https://source.test" }, async () =>
      decpInput(files, async f => { if (f.url === "two") throw Error("INTERRUPTED"); return Readable.from([doc([market()])]); }, window, limits),
    { transaction: async (_id, work) => work({ write: async () => { written = true; }, count: async () => 1, publish: async () => { published = true; return false; } }) })).rejects.toThrow();
    expect(written).toBe(false); expect(published).toBe(false);
  });
  it("empreinte reproductible après consommation intégrale, changement de fenêtre dans la version", async () => {
    const a = input([market()]), b = input([market()]);
    expect(() => a.fingerprint()).toThrow(); await collect(a); await collect(b);
    expect(a.fingerprint()).toBe(b.fingerprint());
    expect(() => a.fingerprint()).toThrow();
  });
  it("catalogue : URL officielle exacte, mois contigus, plafonds, aucun hôte/redirection arbitraire", () => {
    const url = "https://static.data.gouv.fr/resources/donnees-essentielles-de-la-commande-publique-fichiers-consolides/20261004-182636/decp-2026-10.json";
    const w = { start: "2026-10-01", end: "2026-10-12" };
    expect(decpResources({ resources: [{ title: "decp-2026-10.json", url }] }, w)).toEqual([{ month: "2026-10", url }]);
    for (const bad of [url.replace("static.data.gouv.fr", "external.test"), url + "?token=x", url.replace("https:", "http:")])
      expect(() => decpResources({ resources: [{ title: "decp-2026-10.json", url: bad }] }, w)).toThrow();
    expect(() => decpResources({ resources: [{ title: "decp-2026-10.json", url }] }, window)).toThrow("DECP_MISSING_MONTH");
    expect(() => decpResources({}, w)).toThrow();
    expect(sourcesFor("decp")).toEqual(["decp"]); expect(GROUPS.all).toContain("decp"); expect(GROUPS.daily).not.toContain("decp");
  });
  it("passe au client postgres des objets/valeurs, jamais des chaînes JSON pré-encodées", async () => {
    let values: unknown;
    const queries: string[] = [];
    const tx = (first: unknown) => { if (Array.isArray(first) && "raw" in first) { queries.push(first.join("?")); return Promise.resolve([]); } values = first; return "values"; };
    const rows = projectDecp(market(), "2026-10", window, stats());
    const summaries = [];
    for await (const summary of decpSummaries((async function* () { yield* rows; })())) summaries.push(summary);
    await decpWriter(window, "2026-10").write(tx as never, "import-new", summaries);
    expect(values).toEqual(summaries.map(s => ({ ...s, import_id: "import-new" })));
    const client = postgres({ host: "localhost" });
    const serialize = (client.options.serializers as Record<number, (x: unknown) => string>)[3802];
    expect(Array.isArray(JSON.parse(serialize(values)))).toBe(true);
    for (const r of values as Record<string, unknown>[]) for (const c of ["buyers", "items"])
      expect(Array.isArray(JSON.parse(serialize(r[c])))).toBe(true);
    expect(queries.join("\n")).toContain("on conflict"); await client.end();
  });
});
