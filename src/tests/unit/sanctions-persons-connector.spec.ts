import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  SANCTION_IMPORT_SOURCES,
  SANCTION_LIST_KEYS,
  personKeys,
  sanctionKeys,
  type SanctionListKey,
} from "@/lib/connectors/sanctions-lists";

/**
 * La requête SQL du contrôle des personnes est exécutée pour de BON dans PostgreSQL
 * (PGlite) sur les vraies migrations : jsonb_to_recordset, jointures latérales,
 * opérateur jsonb `?|`.
 */
const state = vi.hoisted(() => ({
  db: null as unknown as { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
  demo: false,
  intl: true,
  persons: true,
  fail: false,
}));

const dialect = new PgDialect();
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    async execute(query: SQL) {
      if (state.fail) throw new Error("connexion impossible");
      const { sql, params } = dialect.sqlToQuery(query);
      const result = await state.db.query(sql, params);
      return { rows: result.rows };
    },
  }),
}));
vi.mock("@/lib/env", () => ({
  isDemoMode: () => state.demo,
  isSanctionsIntlEnabled: () => state.intl,
  isSanctionsPersonsEnabled: () => state.persons,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { sanctionsPersons, type SanctionsPersonsRaw } from "@/lib/connectors/sanctions-persons";
import { sanctionsIntl } from "@/lib/connectors/sanctions-intl";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const migration = (name: string) => fs.readFileSync(path.join(process.cwd(), "drizzle", name), "utf8");

let db: PGlite;
const importIds = new Map<SanctionListKey, string>();

async function addImport(list: SanctionListKey, opts: { version?: string; checkedAt?: Date } = {}) {
  const id = crypto.randomUUID();
  importIds.set(list, id);
  const checkedAt = opts.checkedAt ?? new Date(NOW - 3600_000);
  await db.query(
    `insert into open_data_imports (id, source, version, source_url, sha256, record_count, status, started_at, imported_at, checked_at)
     values ($1, $2, $3, 'https://source.test', $4, 1, 'ok', $5, $5, $6)`,
    [id, SANCTION_IMPORT_SOURCES[list], opts.version ?? "sanctions-v3", "a".repeat(64), new Date(checkedAt.getTime() - 3600_000), checkedAt],
  );
}
async function addPerson(
  list: SanctionListKey,
  e: { key: string; name: string; aliases?: string[]; years?: number[]; kind?: "person" | "entity" },
) {
  const kind = e.kind ?? "person";
  const keys = kind === "person" ? personKeys([e.name, ...(e.aliases ?? [])]) : sanctionKeys([e.name, ...(e.aliases ?? [])]);
  // Valeurs jsonb : de vrais tableaux (voir PR « colonnes jsonb »).
  await db.query(
    `insert into sanctions_entries (import_id, list_key, entry_key, sublist, name, aliases, keys, programs, countries, listed_on, kind, birth_years)
     values ($1, $2, $3, 'SDN — OFAC (Trésor)', $4, $5::jsonb, $6::jsonb, '["Programme test"]'::jsonb, '["RU"]'::jsonb, '2022-03-01', $7, $8::jsonb)`,
    [importIds.get(list), list, e.key, e.name, JSON.stringify(e.aliases ?? []), JSON.stringify(keys), kind, JSON.stringify(e.years ?? [])],
  );
}

beforeAll(async () => {
  db = new PGlite();
  state.db = db as never;
  await db.exec(`create type "public"."source_kind" as enum ('sirene', 'manual');`);
  for (const file of ["0014_open_data_imports.sql", "0019_sanctions_entries.sql", "0020_sanctions_persons.sql"]) {
    await db.exec(migration(file).replace(/--> statement-breakpoint/g, ""));
  }
}, 60_000);
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  state.demo = false;
  state.intl = true;
  state.persons = true;
  state.fail = false;
  await db.exec("delete from sanctions_entries; delete from open_data_imports;");
  importIds.clear();
});

async function seed() {
  for (const list of SANCTION_LIST_KEYS) await addImport(list);
  await addPerson("us", { key: "us-1", name: "Dzmitry LUKASHENKA", aliases: ["Dmitri LUKASHENKO"], years: [1980] });
  await addPerson("uk", { key: "uk-1", name: "Jean DUPONT", years: [1960] });
  await addPerson("un", { key: "un-1", name: "Marie MARTIN" });
  await addPerson("ch", { key: "ch-1", name: "Autre Personne Fictive", years: [1970] });
}

const run = async (people: { key: string; name: string; birthYears: number[] }[]) => {
  const res = await sanctionsPersons.match(people, NOW);
  return { res, raw: res.raw as SanctionsPersonsRaw };
};

describe("sanctionsPersons.match — SQL réel sur PostgreSQL", () => {
  it("nom + année concordants : correspondance corroborée, listes consultées nommées", async () => {
    await seed();
    const { res, raw } = await run([{ key: "pe:dzmitry", name: "Dzmitry Lukashenka", birthYears: [1980] }]);
    expect(res.endpoint).toBe("db:sanctions_entries");
    expect(res.httpStatus).toBe(200);
    expect(raw.status).toBe("ok");
    expect(raw.lists.map((l) => l.state)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(raw.queried).toBe(1);
    expect(raw.matches).toHaveLength(1);
    expect(raw.matches[0]).toMatchObject({
      queryKey: "pe:dzmitry", list: "us", name: "exact", birth: "corroborated", birthYears: [1980],
      programs: ["Programme test"], countries: ["RU"], listedOn: "2022-03-01",
    });
  });

  it("homonyme d'une autre année de naissance : écarté et compté, jamais rapporté", async () => {
    await seed();
    const { raw } = await run([{ key: "pe:jean", name: "Jean Dupont", birthYears: [1985] }]);
    expect(raw.matches).toEqual([]);
    expect(raw.excluded).toBe(1);
    expect(raw.status).toBe("ok");
  });

  it("année inconnue : à vérifier (jamais corroborée) ; plusieurs personnes dans une requête", async () => {
    await seed();
    const { raw } = await run([
      { key: "pe:jean", name: "Jean Dupont", birthYears: [] },
      { key: "pe:marie", name: "Marie Martin", birthYears: [1999] },
      { key: "pe:autre", name: "Personne Sans Rapport", birthYears: [1970] },
    ]);
    expect(raw.queried).toBe(3);
    const byKey = Object.fromEntries(raw.matches.map((m) => [m.queryKey, m.birth]));
    expect(byKey).toEqual({ "pe:jean": "unknown", "pe:marie": "unknown" });
    expect(raw.withBirthYear).toBe(2);
  });

  it("alias : le nom réellement rapproché est rapporté", async () => {
    await seed();
    const { raw } = await run([{ key: "pe:d", name: "Dmitri Lukashenko", birthYears: [1980] }]);
    expect(raw.matches[0]).toMatchObject({ nom: "Dzmitry LUKASHENKA", matchedName: "Dmitri LUKASHENKO", birth: "corroborated" });
  });

  it("imports sans personnes (v2) : aucun contrôle — jamais « aucune correspondance »", async () => {
    for (const list of SANCTION_LIST_KEYS) await addImport(list, { version: "sanctions-v2" });
    const { res, raw } = await run([{ key: "pe:x", name: "Jean Dupont", birthYears: [1960] }]);
    expect(res.endpoint).toContain("(source non importée)");
    expect(res.httpStatus).toBe(503);
    expect(raw.status).toBe("non_importe");
    expect(raw.matches).toEqual([]);
  });

  it("une liste seulement en v2 ou périmée : contrôle PARTIEL, correspondances des autres conservées", async () => {
    await seed();
    await db.exec(`update open_data_imports set version = 'sanctions-v2' where source = 'sanctions_ca'`);
    await db.query(`update open_data_imports set checked_at = $1 where source = 'sanctions_ch'`, [new Date(NOW - 100 * 3600_000)]);
    const { res, raw } = await run([{ key: "pe:dzmitry", name: "Dzmitry Lukashenka", birthYears: [1980] }]);
    expect(res.endpoint).toContain("(listes partielles)");
    expect(raw.status).toBe("partiel");
    expect(raw.lists.map((l) => `${l.key}:${l.state}`)).toEqual(["us:ok", "uk:ok", "un:ok", "ch:stale", "ca:missing"]);
    expect(raw.matches).toHaveLength(1);
  });

  it("n'examine que les personnes ; les organisations de même nom ne ressortent pas", async () => {
    await seed();
    await addPerson("us", { key: "us-org", name: "Paul Durand", kind: "entity" });
    const { raw } = await run([{ key: "pe:paul", name: "Paul Durand", birthYears: [] }]);
    expect(raw.matches).toEqual([]);
  });

  it("les personnes n'apparaissent JAMAIS dans le contrôle des sociétés", async () => {
    await seed();
    await addPerson("us", { key: "us-p", name: "Rosneft Oil Company", years: [1970] });
    const org = await sanctionsIntl.match([{ key: "subject", name: "Rosneft Oil Company" }], NOW);
    expect((org.raw as { matches: unknown[] }).matches).toEqual([]);
  });

  it("limite par dossier : les personnes avec année d'abord, le reste non contrôlé et dit", async () => {
    await seed();
    const many = Array.from({ length: 45 }, (_, i) => ({
      key: `pe:${i}`, name: `Prenom${i} Nom${i}`, birthYears: i < 3 ? [1970] : [],
    }));
    const { raw } = await run(many);
    expect(raw.queried).toBe(40);
    expect(raw.notQueried).toBe(5);
    expect(raw.withBirthYear).toBe(3);
  });

  it("nom très courant : la limite écarte les voisines éloignées, pas la correspondance complète", async () => {
    await seed();
    for (let i = 0; i < 230; i++) {
      await addPerson("us", { key: `crowd-${i}`, name: `Mohamed Ali Famille${String(i).padStart(3, "0")}`, years: [1960] });
    }
    await addPerson("us", { key: "target", name: "Mohamed Ali Zzzfinal", years: [1975] });
    const { raw } = await run([{ key: "pe:m", name: "Mohamed Ali Zzzfinal", birthYears: [1975] }]);
    expect(raw.truncated).toBe(true);
    expect(raw.matches.map((m) => m.entryKey)).toEqual(["target"]);
    expect(raw.matches[0].birth).toBe("corroborated");
  });

  it("noms d'un seul mot : non contrôlés", async () => {
    await seed();
    const { raw } = await run([{ key: "pe:m", name: "Mohamed", birthYears: [1970] }]);
    expect(raw.queried).toBe(0);
    expect(raw.notQueried).toBe(1);
  });

  it("base indisponible → « indisponible », jamais d'exception ; drapeau éteint ou démo → fixture", async () => {
    state.fail = true;
    const down = await run([{ key: "pe:x", name: "Jean Dupont", birthYears: [] }]);
    expect(down.res.endpoint).toContain("(exception)");
    expect(down.raw.status).toBe("indisponible");
    state.fail = false;
    state.persons = false;
    expect((await run([{ key: "pe:x", name: "Jean Dupont", birthYears: [] }])).res.isFixture).toBe(true);
    state.persons = true;
    state.demo = true;
    expect((await run([{ key: "pe:x", name: "Jean Dupont", birthYears: [] }])).res.isFixture).toBe(true);
  });
});
