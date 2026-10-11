import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  execute: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  importEnabled: true,
}));

vi.mock("@/lib/connectors/http", () => ({ fetchJson: mocks.fetchJson, RateLimiter: class {} }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ execute: mocks.execute }) }));
vi.mock("@/lib/env", () => ({
  env: { TRESOR_GELS_BASE_URL: "https://gels.test/api/v1" },
  isDemoMode: () => false,
  isTresorGelsEnabled: () => true,
  isTresorGelsImportEnabled: () => mocks.importEnabled,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}));

import { gelsInput, gelsWriter } from "../../../scripts/import/tresor-gels";
import { extractGelsEntries, matchGelsEntries } from "@/lib/connectors/tresor-gels-match";
import { GELS_IMPORT_MAX_AGE_MS, readImportedGels } from "@/lib/connectors/tresor-gels-import";

const entry = (id: number, nature: string, nom: string, alias?: string) => ({
  IdRegistre: id,
  Nature: nature,
  Nom: nom,
  RegistreDetail: [
    ...(alias ? [{ TypeChamp: "ALIAS", Valeur: [{ Alias: alias, Commentaire: "PRIVE" }] }] : []),
    { TypeChamp: "DATE_DE_NAISSANCE", Valeur: [{ DateNaissance: "1970-01-01" }] },
    { TypeChamp: "ADRESSE_PM", Valeur: [{ Adresse: "1 rue SECRETE" }] },
  ],
});
const publication = {
  Publications: {
    DatePublication: "2026-10-09T14:50:59+02:00",
    PublicationDetail: [
      entry(1, "Personne morale", "ACME INTERNATIONAL HOLDING LTD", "ACME INTL"),
      entry(2, "Personne physique", "DUPONT Jean"),
      entry(3, "Navire", "NAVIRE FANTOME"),
      entry(4, "Personne physique", "MARTIN Paul"),
      entry(5, "Personne morale", "AUTRE ENTITE FICTIVE"),
    ],
  },
};
const stream = (v: unknown) => Readable.from([Buffer.from(typeof v === "string" ? v : JSON.stringify(v))]);
async function consume(source: Readable, minimumEntries = 1) {
  const input = gelsInput(source, { minimumEntries });
  const rows = [];
  for await (const row of input.rows) rows.push(row);
  return { rows, stats: input.stats, hash: input.fingerprint() };
}

describe("import du registre des gels — projection", () => {
  it("ne conserve que les personnes morales et navires, avec le total du registre", async () => {
    const r = await consume(stream(publication));
    expect(r.rows.map((x) => x.nom)).toEqual([
      "ACME INTERNATIONAL HOLDING LTD",
      "NAVIRE FANTOME",
      "AUTRE ENTITE FICTIVE",
    ]);
    expect(r.rows.map((x) => x.position)).toEqual([0, 1, 2]);
    expect(r.stats).toEqual({ received: 5, naturalPersons: 2 });
    expect(r.rows.every((x) => x.register_total === 5)).toBe(true);
    expect(r.rows[0]).toMatchObject({ aliases: ["ACME INTL"], publication_date: "2026-10-09T14:50:59+02:00" });
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("minimise : aucune personne physique, identification, adresse, naissance ni commentaire", async () => {
    const r = await consume(stream(publication));
    const dump = JSON.stringify(r.rows);
    expect(dump).not.toMatch(/DUPONT|MARTIN|SECRETE|1970|PRIVE|DATE_DE_NAISSANCE|ADRESSE/);
  });

  it("le rapprochement sur le registre filtré est identique à celui du registre complet", () => {
    const all = extractGelsEntries(publication).entries;
    const kept = all.filter((e) => !/physique/i.test(e.nature ?? ""));
    for (const name of ["Acme International Holding", "ACME INTL", "Navire Fantome", "Dupont Jean", "Danone"]) {
      expect(matchGelsEntries(kept, { name })).toEqual(matchGelsEntries(all, { name }));
    }
  });

  it("refuse un schéma non reconnu, un JSON invalide et un registre trop petit", async () => {
    await expect(consume(stream({ Autre: [] }))).rejects.toThrow("GELS_SCHEMA_UNRECOGNIZED");
    await expect(consume(stream("<html>panne</html>"))).rejects.toThrow("GELS_INVALID_JSON");
    await expect(consume(stream(publication), 100)).rejects.toThrow("GELS_INCOMPLETE_SOURCE");
  });

  it("ne finalise jamais un flux interrompu", async () => {
    const input = gelsInput(Readable.from((async function* () {
      yield Buffer.from("{\"Publications\":");
      throw new Error("coupure réseau");
    })()), { minimumEntries: 1 });
    await expect((async () => { for await (const r of input.rows) void r; })()).rejects.toThrow();
    expect(() => input.fingerprint()).toThrow();
  });

  it("borne la taille du fichier", async () => {
    const input = gelsInput(Readable.from([Buffer.alloc(64 * 1024 * 1024 + 1)]));
    await expect((async () => { for await (const r of input.rows) void r; })()).rejects.toThrow("SOURCE_TOO_LARGE");
  });

  it("écrit par (import_id, position) avec les alias en JSON", async () => {
    let values: unknown, query = "";
    const tx = (first: unknown) => {
      if (Array.isArray(first) && "raw" in first) { query = first.join("?"); return Promise.resolve([]); }
      values = first;
      return "values";
    };
    await gelsWriter.write(tx as never, "import-1", [
      { position: 0, nom: "ACME", nature: "Personne morale", aliases: ["A", "B"], publication_date: null, register_total: 5 },
    ]);
    expect(query).toContain("on conflict (import_id, position) do update");
    expect(values).toEqual([expect.objectContaining({ import_id: "import-1", aliases: "[\"A\",\"B\"]" })]);
  });
});

const NOW = Date.parse("2026-10-11T12:00:00Z");
const row = (over: Record<string, unknown> = {}) => ({
  imported_at: "2026-10-11T04:47:30.000Z",
  checked_at: "2026-10-11T04:47:30.000Z",
  nom: "ACME INTERNATIONAL HOLDING LTD",
  nature: "Personne morale",
  aliases: ["ACME INTL"],
  publication_date: "2026-10-09",
  register_total: 5,
  ...over,
});

describe("readImportedGels — lecture et garde-fous de fraîcheur", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it("copie fraîche : entrées, date de publication, total et dates d'import", async () => {
    mocks.execute.mockResolvedValue({ rows: [row(), row({ nom: "AUTRE", aliases: "[]" })] });
    const res = await readImportedGels(NOW);
    expect(res.state).toBe("fresh");
    if (res.state !== "fresh") return;
    expect(res.data.entries).toEqual([
      { nom: "ACME INTERNATIONAL HOLDING LTD", nature: "Personne morale", aliases: ["ACME INTL"] },
      { nom: "AUTRE", nature: "Personne morale", aliases: [] },
    ]);
    expect(res.data.registerTotal).toBe(5);
    expect(res.data.publicationDate).toBe("2026-10-09");
    expect(mocks.execute).toHaveBeenCalledTimes(1); // snapshot unique
  });

  it("aucun import validé : « missing » (jamais une absence)", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });
    expect((await readImportedGels(NOW)).state).toBe("missing");
  });

  it("copie plus ancienne que 48 h depuis la dernière vérification : « stale »", async () => {
    const old = new Date(NOW - GELS_IMPORT_MAX_AGE_MS - 60_000).toISOString();
    mocks.execute.mockResolvedValue({ rows: [row({ checked_at: old })] });
    expect((await readImportedGels(NOW)).state).toBe("stale");
  });

  it("une copie inchangée mais récemment vérifiée reste servie", async () => {
    // Importée il y a 20 jours (registre inchangé), vérifiée ce matin.
    mocks.execute.mockResolvedValue({
      rows: [row({ imported_at: "2026-09-20T04:47:00.000Z", checked_at: "2026-10-11T04:47:00.000Z" })],
    });
    expect((await readImportedGels(NOW)).state).toBe("fresh");
  });

  it("lignes illisibles ou dates absentes : « invalid »", async () => {
    mocks.execute.mockResolvedValue({ rows: [row({ nom: null })] });
    expect((await readImportedGels(NOW)).state).toBe("invalid");
    mocks.execute.mockResolvedValue({ rows: [row({ aliases: "pas du json" })] });
    expect((await readImportedGels(NOW)).state).toBe("invalid");
    mocks.execute.mockResolvedValue({ rows: [row({ checked_at: null })] });
    expect((await readImportedGels(NOW)).state).toBe("invalid");
    mocks.execute.mockResolvedValue({ rows: [row({ register_total: 0 })] });
    expect((await readImportedGels(NOW)).state).toBe("invalid");
  });

  it("erreur base ou table absente : « error », tracée, jamais levée", async () => {
    mocks.execute.mockImplementation(async () => {
      throw new Error("relation \"tresor_gels_entries\" does not exist");
    });
    expect((await readImportedGels(NOW)).state).toBe("error");
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

const publicationLive = {
  Publications: {
    DatePublication: "2026-10-01",
    PublicationDetail: [
      { Nature: "Personne morale", Nom: "ACME INTERNATIONAL HOLDING LTD" },
      { Nature: "Personne physique", Nom: "DUPONT Jean" },
      { Nature: "Personne morale", Nom: "AUTRE ENTITE FICTIVE" },
    ],
  },
};
async function connector() {
  vi.resetModules();
  return (await import("@/lib/connectors/tresor-gels")).tresorGels;
}

describe("tresorGels.match — import en base puis repli sur le téléchargement", () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.execute.mockReset();
    mocks.importEnabled = true;
    mocks.fetchJson.mockResolvedValue({ data: publicationLive, status: 200 });
  });

  it("copie fraîche : aucun téléchargement, même correspondance, traçabilité de l'import", async () => {
    mocks.execute.mockResolvedValue({ rows: [row({ checked_at: new Date().toISOString() })] });
    const res = await (await connector()).match({ siren: "123456789", name: "Acme International Holding" });
    expect(mocks.fetchJson).not.toHaveBeenCalled();
    const raw = res.raw as Record<string, unknown>;
    expect(res.endpoint).toBe("db:tresor_gels_entries");
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect(raw.status).toBe("ok");
    expect(raw.entriesCount).toBe(5);
    expect((raw.matches as unknown[]).length).toBe(1);
    expect(raw.import).toMatchObject({ importedAt: expect.any(String), checkedAt: expect.any(String) });
  });

  it.each([
    ["aucun import", { rows: [] }],
    ["copie périmée", { rows: [row({ checked_at: "2020-01-01T00:00:00Z" })] }],
    ["lignes illisibles", { rows: [row({ nom: null })] }],
  ])("%s : repli sur le téléchargement direct", async (_label, result) => {
    mocks.execute.mockResolvedValue(result);
    const res = await (await connector()).match({ siren: "123456789", name: "Acme International Holding" });
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
    expect(res.endpoint).toContain("gels.test");
    expect((res.raw as Record<string, unknown>).entriesCount).toBe(3);
    expect(((res.raw as Record<string, unknown>).matches as unknown[]).length).toBe(1);
  });

  it("erreur base : repli sur le téléchargement, sans lever", async () => {
    mocks.execute.mockImplementation(async () => {
      throw new Error("boom");
    });
    const res = await (await connector()).match({ siren: "123456789", name: "Acme International Holding" });
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
    expect((res.raw as Record<string, unknown>).status).toBe("ok");
  });

  it("flag éteint : la base n'est jamais consultée (comportement historique)", async () => {
    mocks.importEnabled = false;
    await (await connector()).match({ siren: "123456789", name: "Acme International Holding" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.fetchJson).toHaveBeenCalledTimes(1);
  });
});
