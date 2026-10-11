import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { getConnectorStatuses } from "@/lib/connectors/status";
import {
  CONNECTOR_SOURCE,
  HEALTH_SAMPLE,
  getConnectorHealth,
  isFailedConsultation,
  issueOf,
  observeConnectors,
  type ConsultationRow,
} from "@/lib/data/connector-health";

const state = vi.hoisted(() => ({
  db: null as unknown as { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
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

const T0 = Date.parse("2026-10-11T12:00:00Z");
const row = (over: Partial<ConsultationRow> & { minutesAgo?: number } = {}): ConsultationRow => ({
  source: "opensanctions",
  endpoint: "https://api.opensanctions.org/match/default",
  http_status: "200",
  is_fixture: "false",
  requested_at: new Date(T0 - (over.minutesAgo ?? 0) * 60_000).toISOString(),
  ...over,
});

describe("isFailedConsultation / issueOf", () => {
  it("erreur HTTP ou consultation dégradée = échec ; un 200 propre n'en est pas un", () => {
    expect(isFailedConsultation(row())).toBe(false);
    expect(isFailedConsultation(row({ http_status: "500" }))).toBe(true);
    expect(isFailedConsultation(row({ http_status: "402" }))).toBe(true);
    expect(isFailedConsultation(row({ endpoint: "https://x.test (schéma non reconnu)" }))).toBe(true);
    expect(isFailedConsultation(row({ endpoint: "db:sanctions_entries (listes partielles)" }))).toBe(true);
  });

  it("nomme la cause : statut HTTP ou marqueur de dégradation", () => {
    expect(issueOf(row({ http_status: "401" }))).toBe("HTTP 401");
    expect(issueOf(row({ endpoint: "https://x.test (exception)" }))).toBe("exception");
    expect(issueOf(row({ endpoint: "https://x.test (erreur 429)" }))).toBe("erreur 429");
  });
});

describe("observeConnectors", () => {
  it("clé posée mais refusée (402 sur les dernières consultations) → « en échec », pas « live »", () => {
    const out = observeConnectors([
      row({ http_status: "402", minutesAgo: 1 }),
      row({ http_status: "402", minutesAgo: 5 }),
      row({ http_status: "402", minutesAgo: 9 }),
    ]);
    expect(out.get("opensanctions")).toMatchObject({
      state: "failing", consulted: 3, ok: 0, lastIssue: "HTTP 402",
    });
  });

  it("succès récent après des échecs plus anciens → « dégradé » (incident rapporté)", () => {
    const out = observeConnectors([
      row({ minutesAgo: 1 }),
      row({ minutesAgo: 10 }),
      row({ http_status: "429", minutesAgo: 20 }),
    ]);
    expect(out.get("opensanctions")).toMatchObject({ state: "degraded", consulted: 3, ok: 2, lastIssue: "HTTP 429" });
  });

  it("toutes consultations réussies → « opérationnel » ; la date est la plus récente", () => {
    const out = observeConnectors([row({ minutesAgo: 30 }), row({ minutesAgo: 2 })]);
    expect(out.get("opensanctions")).toMatchObject({
      state: "operational", consulted: 2, ok: 2, lastIssue: null, lastAt: new Date(T0 - 2 * 60_000).toISOString(),
    });
  });

  it("les fixtures ne comptent jamais : une source seulement en démo n'est pas « opérationnelle »", () => {
    const out = observeConnectors([row({ is_fixture: "true" }), row({ is_fixture: true })]);
    expect(out.has("opensanctions")).toBe(false);
  });

  it("sources indépendantes", () => {
    const out = observeConnectors([
      row({ source: "pappers", http_status: "401", minutesAgo: 1 }),
      row({ source: "pappers", http_status: "401", minutesAgo: 2 }),
      row({ source: "pappers", http_status: "401", minutesAgo: 3 }),
      row({ source: "gleif", endpoint: "https://api.gleif.org/x" }),
    ]);
    expect(out.get("pappers")?.state).toBe("failing");
    expect(out.get("gleif")?.state).toBe("operational");
  });

  it("moins de trois consultations, toutes en échec : « dégradé », jamais « en échec »", () => {
    const one = observeConnectors([row({ source: "pappers", http_status: "401" })]);
    expect(one.get("pappers")).toMatchObject({ state: "degraded", consulted: 1, ok: 0, lastIssue: "HTTP 401" });
    const two = observeConnectors([
      row({ source: "pappers", http_status: "401", minutesAgo: 1 }),
      row({ source: "pappers", http_status: "401", minutesAgo: 2 }),
    ]);
    expect(two.get("pappers")?.state).toBe("degraded");
  });

  it("« introuvable » (404) est une absence, pas une panne : Companies House reste opérationnel", () => {
    const ch = "https://api.company-information.service.gov.uk/company/";
    const out = observeConnectors([
      row({ source: "companies_house", http_status: "404", endpoint: ch + "00000001", minutesAgo: 1 }),
      row({ source: "companies_house", http_status: "404", endpoint: ch + "00000002", minutesAgo: 2 }),
      row({ source: "companies_house", http_status: "404", endpoint: ch + "00000003", minutesAgo: 3 }),
    ]);
    expect(out.get("companies_house")).toMatchObject({ state: "operational", ok: 3, lastIssue: null });
    // Même chose pour Pappers (SIREN non référencé : « (erreur 404) »).
    const pappers = observeConnectors([
      row({ source: "pappers", http_status: "404", endpoint: "https://api.pappers.fr/v2/entreprise (erreur 404)" }),
    ]);
    expect(pappers.get("pappers")?.state).toBe("operational");
  });

  it("les sentinelles sans appel (requête vide, SIREN invalide) ne comptent pas comme consultation", () => {
    const out = observeConnectors([
      row({ source: "ban", endpoint: "ban:requete-vide", http_status: "0" }),
      row({ source: "qualiopi", endpoint: "qualiopi:siren-invalide", http_status: "0" }),
      row({ source: "vies", endpoint: "vies:siren-non-derivable:123", http_status: "0" }),
    ]);
    expect(out.size).toBe(0);
    // Une vraie consultation de la même source reste comptée.
    const mixed = observeConnectors([
      row({ source: "ban", endpoint: "ban:requete-vide", http_status: "0", minutesAgo: 1 }),
      row({ source: "ban", endpoint: "https://api-adresse.data.gouv.fr/search/?q=x&limit=1", minutesAgo: 2 }),
    ]);
    expect(mixed.get("ban")).toMatchObject({ state: "operational", consulted: 1 });
  });

  it("les lectures d'import (db:…) sont de vraies consultations", () => {
    const out = observeConnectors([row({ source: "sanctions_intl", endpoint: "db:sanctions_entries" })]);
    expect(out.get("sanctions_intl")?.state).toBe("operational");
  });

  it("n'examine que les consultations les plus récentes (échantillon borné)", () => {
    const rows = [
      ...Array.from({ length: HEALTH_SAMPLE }, (_, i) => row({ minutesAgo: i })),
      row({ http_status: "500", minutesAgo: HEALTH_SAMPLE + 5 }),
    ];
    expect(observeConnectors(rows).get("opensanctions")).toMatchObject({ state: "operational", consulted: HEALTH_SAMPLE });
  });
});

describe("table de correspondance connecteur → source enregistrée", () => {
  it("couvre chaque connecteur de la page Réglages", () => {
    for (const s of getConnectorStatuses()) {
      expect(s.key in CONNECTOR_SOURCE, `${s.key} absent de CONNECTOR_SOURCE`).toBe(true);
    }
  });
});

describe("getConnectorHealth — SQL réel sur PostgreSQL", () => {
  let db: PGlite;
  const originalUrl = process.env.DATABASE_URL;
  beforeAll(async () => {
    db = new PGlite();
    state.db = db as never;
    await db.exec(`
      create type source_kind as enum ('opensanctions', 'pappers', 'sirene', 'ban', 'fixture');
      create table source_records (
        id uuid primary key default gen_random_uuid(),
        case_id uuid not null,
        source source_kind not null,
        endpoint text not null,
        http_status text,
        requested_at timestamptz not null default now(),
        is_fixture text not null default 'false'
      );
    `);
  });
  afterAll(async () => {
    // L'environnement du processus est partagé entre fichiers d'un même worker.
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    await db.close();
  });
  beforeEach(async () => {
    state.fail = false;
    process.env.DATABASE_URL = "postgres://test";
    await db.exec("delete from source_records;");
  });

  const insert = (source: string, status: string, ago: string, fixture = "false", endpoint = "https://x.test") =>
    db.query(
      `insert into source_records (case_id, source, endpoint, http_status, requested_at, is_fixture)
       values (gen_random_uuid(), $1::source_kind, $2, $3, now() - $4::interval, $5)`,
      [source, endpoint, status, ago, fixture],
    );

  it("regroupe par source, ignore fixtures et consultations hors fenêtre", async () => {
    await insert("opensanctions", "402", "1 hour");
    await insert("opensanctions", "402", "2 hours");
    await insert("opensanctions", "402", "3 hours");
    await insert("opensanctions", "200", "30 days");       // hors fenêtre
    await insert("sirene", "200", "5 minutes");
    await insert("sirene", "200", "5 minutes", "true");     // fixture
    await insert("pappers", "200", "10 minutes", "false", "https://x.test (exception)");
    await insert("ban", "0", "10 minutes", "false", "ban:requete-vide"); // sentinelle : aucun appel
    const out = await getConnectorHealth();
    expect(out?.get("opensanctions")).toMatchObject({ state: "failing", consulted: 3, ok: 0, lastIssue: "HTTP 402" });
    expect(out?.get("sirene")).toMatchObject({ state: "operational", consulted: 1 });
    // Une seule consultation en échec : « dégradé » (la série de trois n'est pas atteinte).
    expect(out?.get("pappers")).toMatchObject({ state: "degraded", consulted: 1, lastIssue: "exception" });
    expect(out?.has("ban")).toBe(false);
  });

  it("base indisponible ou non configurée : null, jamais un « opérationnel » inventé", async () => {
    state.fail = true;
    expect(await getConnectorHealth()).toBeNull();
    state.fail = false;
    delete process.env.DATABASE_URL;
    expect(await getConnectorHealth()).toBeNull();
  });
});
