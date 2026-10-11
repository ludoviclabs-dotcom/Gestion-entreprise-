import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  SANCTION_IMPORT_SOURCES,
  SANCTION_LIST_KEYS,
  sanctionKeys,
  type SanctionListKey,
} from "@/lib/connectors/sanctions-lists";

/**
 * La requête SQL du connecteur est exécutée pour de BON dans PostgreSQL (PGlite) sur
 * les vraies migrations : opérateurs jsonb, DISTINCT ON, jointure latérale.
 */
const state = vi.hoisted(() => ({
  db: null as unknown as { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
  demo: false,
  enabled: true,
  fail: false,
}));

const dialect = new PgDialect();
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    async execute(query: SQL) {
      if (state.fail) throw new Error("relation \"sanctions_entries\" does not exist");
      const { sql, params } = dialect.sqlToQuery(query);
      const result = await state.db.query(sql, params);
      return { rows: result.rows };
    },
  }),
}));
vi.mock("@/lib/env", () => ({
  isDemoMode: () => state.demo,
  isSanctionsIntlEnabled: () => state.enabled,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { sanctionsIntl, SANCTIONS_MAX_AGE_MS, type SanctionsIntlRaw } from "@/lib/connectors/sanctions-intl";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const migration = (name: string) => fs.readFileSync(path.join(process.cwd(), "drizzle", name), "utf8");

let db: PGlite;
const importIds = new Map<SanctionListKey, string>();

async function addImport(list: SanctionListKey, checkedAt: Date) {
  const id = crypto.randomUUID();
  importIds.set(list, id);
  await db.query(
    `insert into open_data_imports (id, source, version, source_url, sha256, record_count, status, started_at, imported_at, checked_at)
     values ($1, $2, 'sanctions-v1', 'https://source.test', $3, 1, 'ok', $4, $4, $5)`,
    [id, SANCTION_IMPORT_SOURCES[list], "a".repeat(64), new Date(checkedAt.getTime() - 3600_000), checkedAt],
  );
  return id;
}
async function addEntry(
  list: SanctionListKey,
  e: { key: string; name: string; aliases?: string[]; kind?: "entity" | "unknown"; sublist?: string; programs?: string[]; countries?: string[] },
) {
  await db.query(
    `insert into sanctions_entries (import_id, list_key, entry_key, sublist, name, aliases, keys, programs, countries, listed_on, kind)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, '2022-03-01', $10)`,
    [
      importIds.get(list), list, e.key, e.sublist ?? null, e.name,
      JSON.stringify(e.aliases ?? []),
      JSON.stringify(sanctionKeys([e.name, ...(e.aliases ?? [])])),
      JSON.stringify(e.programs ?? ["Programme test"]),
      JSON.stringify(e.countries ?? ["Russia"]),
      e.kind ?? "entity",
    ],
  );
}

beforeAll(async () => {
  db = new PGlite();
  state.db = db as never;
  // Les migrations réelles, dans l'ordre (le type d'enum existe avant 0018).
  await db.exec(`create type "public"."source_kind" as enum ('sirene', 'manual');`);
  await db.exec(migration("0014_open_data_imports.sql").replace(/--> statement-breakpoint/g, ""));
  await db.exec(migration("0019_sanctions_entries.sql").replace(/--> statement-breakpoint/g, ""));
});
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  state.demo = false;
  state.enabled = true;
  state.fail = false;
  await db.exec("delete from sanctions_entries; delete from open_data_imports;");
  importIds.clear();
});

const fresh = new Date(NOW - 3600_000);
async function seedAllLists() {
  for (const list of SANCTION_LIST_KEYS) await addImport(list, fresh);
  await addEntry("us", { key: "us-1", name: "Rosneft Oil Company", aliases: ["Rosneft"], sublist: "SDN — OFAC (Trésor)", programs: ["RUSSIA-EO14024"] });
  await addEntry("uk", { key: "uk-1", name: "Rosneft Oil Company", countries: ["Russia"] });
  await addEntry("un", { key: "un-1", name: "Autre Entité Fictive" });
  await addEntry("ch", { key: "ch-1", name: "LLC Atlas", countries: [] });
  await addEntry("ca", { key: "ca-1", name: "Quelque Chose Complètement Différent" });
}

describe("sanctionsIntl.match — SQL réel sur PostgreSQL", () => {
  it("cinq listes à jour : correspondances par liste, couverture complète", async () => {
    await seedAllLists();
    const res = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    const raw = res.raw as SanctionsIntlRaw;
    expect(res.endpoint).toBe("db:sanctions_entries");
    expect(res.httpStatus).toBe(200);
    expect(res.isFixture).toBe(false);
    expect(raw.status).toBe("ok");
    expect(raw.lists.map((l) => l.state)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(raw.matches.map((m) => `${m.list}:${m.matchType}`).sort()).toEqual(["uk:exact", "us:exact"]);
    const us = raw.matches.find((m) => m.list === "us")!;
    expect(us).toMatchObject({
      queryKey: "subject", sublist: "SDN — OFAC (Trésor)", programs: ["RUSSIA-EO14024"],
      countries: ["Russia"], listedOn: "2022-03-01", kind: "entity",
    });
    expect(raw.truncated).toBe(false);
  });

  it("aucune correspondance : les listes consultées sont quand même nommées", async () => {
    await seedAllLists();
    const res = await sanctionsIntl.match([{ key: "subject", name: "ELECTRICITE DE FRANCE" }], NOW);
    const raw = res.raw as SanctionsIntlRaw;
    expect(raw.status).toBe("ok");
    expect(raw.matches).toEqual([]);
    expect(raw.lists).toHaveLength(5);
    expect(raw.lists.every((l) => l.checkedAt !== null)).toBe(true);
  });

  it("une liste jamais importée : consultation PARTIELLE, correspondances des autres conservées", async () => {
    for (const list of ["us", "uk", "un", "ch"] as const) await addImport(list, fresh);
    await addEntry("us", { key: "us-1", name: "Rosneft Oil Company" });
    const res = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    const raw = res.raw as SanctionsIntlRaw;
    expect(res.endpoint).toBe("db:sanctions_entries (listes partielles)");
    expect(res.httpStatus).toBe(200);
    expect(raw.status).toBe("partiel");
    expect(raw.lists.find((l) => l.key === "ca")).toMatchObject({ state: "missing", importedAt: null });
    expect(raw.matches).toHaveLength(1);
  });

  it("une liste vérifiée il y a plus de 72 h : « stale », jamais comptée comme à jour", async () => {
    await addImport("us", new Date(NOW - SANCTIONS_MAX_AGE_MS - 60_000));
    for (const list of ["uk", "un", "ch", "ca"] as const) await addImport(list, fresh);
    await addEntry("us", { key: "us-1", name: "Rosneft Oil Company" });
    const res = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    const raw = res.raw as SanctionsIntlRaw;
    expect(raw.status).toBe("partiel");
    expect(raw.lists.find((l) => l.key === "us")?.state).toBe("stale");
    expect(res.endpoint).toContain("(listes partielles)");
    // Une copie non à jour reste exploitée (la correspondance est rapportée), mais dite.
    expect(raw.matches).toHaveLength(1);
  });

  it("aucun import validé : « source non importée », jamais une absence", async () => {
    const res = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    expect(res.endpoint).toBe("db:sanctions_entries (source non importée)");
    expect(res.httpStatus).toBe(503);
    expect((res.raw as SanctionsIntlRaw).status).toBe("non_importe");
    expect((res.raw as SanctionsIntlRaw).matches).toEqual([]);
  });

  it("le pré-filtre exige deux clés communes dès deux mots significatifs", async () => {
    await seedAllLists();
    await addEntry("us", { key: "us-2", name: "Banque Centrale Fictive" });
    // « Banque Populaire » ne partage qu'UN mot avec « Banque Centrale Fictive ».
    const res = await sanctionsIntl.match([{ key: "subject", name: "Banque Populaire" }], NOW);
    expect((res.raw as SanctionsIntlRaw).matches).toEqual([]);
  });

  it("interroge aussi les sociétés mères, chaque correspondance gardant sa requête", async () => {
    await seedAllLists();
    const res = await sanctionsIntl.match(
      [
        { key: "subject", name: "ELECTRICITE DE FRANCE" },
        { key: "lei:ABC", name: "Rosneft Oil Company" },
      ],
      NOW,
    );
    const raw = res.raw as SanctionsIntlRaw;
    expect(raw.matches.length).toBeGreaterThan(0);
    expect(raw.matches.every((m) => m.queryKey === "lei:ABC")).toBe(true);
  });

  it("signale une pré-sélection tronquée plutôt que de la taire", async () => {
    await addImport("us", fresh);
    for (const list of ["uk", "un", "ch", "ca"] as const) await addImport(list, fresh);
    // 1 600 candidates partageant la clé « gener » : au-delà du plafond par liste.
    await db.query(
      `insert into sanctions_entries (import_id, list_key, entry_key, name, keys, kind)
       select $1, 'us', 'g-' || i, 'Generic Holdings ' || i, '["gener","holdi"]'::jsonb, 'entity' from generate_series(1, 1600) i`,
      [importIds.get("us")],
    );
    const res = await sanctionsIntl.match([{ key: "subject", name: "Generic Holdings" }], NOW);
    expect((res.raw as SanctionsIntlRaw).truncated).toBe(true);
  });

  it("erreur base ou table absente : consultation dégradée, jamais levée", async () => {
    state.fail = true;
    const res = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    expect(res.endpoint).toBe("db:sanctions_entries (exception)");
    expect(res.httpStatus).toBe(503);
    expect(res.isFixture).toBe(false);
  });

  it("démonstration ou drapeau éteint : fixture, aucune lecture", async () => {
    state.enabled = false;
    const off = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    expect(off).toMatchObject({ isFixture: true, httpStatus: 0, endpoint: "fixture:sanctions-intl" });
    state.enabled = true;
    state.demo = true;
    const demo = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    expect(demo.isFixture).toBe(true);
  });
});
