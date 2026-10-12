import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { isPressConsultationFailed } from "@/lib/data/press-status";
import { unachievedGdeltRecords } from "@/lib/data/press-sql";

vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));

describe("isPressConsultationFailed — la presse a-t-elle été réellement consultée ?", () => {
  const row = (over: Partial<{ source: string; endpoint: string; httpStatus: number; isFixture: boolean }> = {}) => ({
    source: "gdelt", endpoint: "https://api.gdeltproject.org/api/v2/doc/doc?query=%22X%22", httpStatus: 200, isFixture: false, ...over,
  });

  it("aucune ligne GDELT : rien n'a été tenté, ce n'est pas un échec de consultation", () => {
    expect(isPressConsultationFailed([])).toBe(false);
    expect(isPressConsultationFailed([{ ...row({ source: "bodacc" }) }])).toBe(false);
  });
  it("429, délai dépassé, réponse non JSON, statut 0 : consultation non aboutie", () => {
    expect(isPressConsultationFailed([row({ httpStatus: 429, endpoint: "https://x (erreur 429)" })])).toBe(true);
    expect(isPressConsultationFailed([row({ httpStatus: 0, endpoint: "https://x (délai dépassé)" })])).toBe(true);
    expect(isPressConsultationFailed([row({ httpStatus: 200, endpoint: "https://x (schéma non reconnu)" })])).toBe(true);
    expect(isPressConsultationFailed([row({ httpStatus: 0 })])).toBe(true);
  });
  it("une consultation réussie suffit : la presse a été consultée", () => {
    expect(isPressConsultationFailed([row({ httpStatus: 429, endpoint: "https://x (erreur 429)" }), row()])).toBe(false);
  });
  it("les fixtures ne comptent jamais comme consultation", () => {
    expect(isPressConsultationFailed([row({ isFixture: true, httpStatus: 0 })])).toBe(false);
  });
});

describe("unachievedGdeltRecords — SQL réel sur PostgreSQL", () => {
  const CASE = "11111111-2222-4333-8444-555555555555";
  const OTHER = "99999999-2222-4333-8444-555555555555";
  let db: PGlite;
  const dialect = new PgDialect();

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create type source_kind as enum ('gdelt', 'bodacc');
      create table source_records (
        id uuid primary key default gen_random_uuid(),
        case_id uuid not null,
        source source_kind not null,
        endpoint text not null,
        http_status text
      );
      create table evidence (id uuid primary key default gen_random_uuid(), source_record_id uuid);
    `);
  }, 60_000);
  afterAll(async () => { await db.close(); });

  const add = async (caseId: string, source: string, endpoint: string, status: string | null) => {
    const r = await db.query<{ id: string }>(
      `insert into source_records (case_id, source, endpoint, http_status) values ($1, $2::source_kind, $3, $4) returning id`,
      [caseId, source, endpoint, status],
    );
    return r.rows[0].id;
  };

  it("sélectionne les consultations GDELT non abouties sans preuve rattachée — et elles seules", async () => {
    const ok = await add(CASE, "gdelt", "https://api.gdeltproject.org/api/v2/doc/doc?query=%22X%22", "200");
    const throttled = await add(CASE, "gdelt", "https://x (erreur 429)", "429");
    const timeout = await add(CASE, "gdelt", "https://x (délai dépassé)", "0");
    const nonJson = await add(CASE, "gdelt", "https://x (schéma non reconnu)", "200");
    const exception = await add(CASE, "gdelt", "https://x (exception)", "0");
    const nullStatus = await add(CASE, "gdelt", "https://x", null);
    const withEvidence = await add(CASE, "gdelt", "https://x (erreur 429)", "429");
    await db.query(`insert into evidence (source_record_id) values ($1)`, [withEvidence]);
    const otherSource = await add(CASE, "bodacc", "https://bodacc (erreur 500)", "500");
    const otherCase = await add(OTHER, "gdelt", "https://x (erreur 429)", "429");

    const { sql, params } = dialect.sqlToQuery(unachievedGdeltRecords(CASE));
    // Colonnes qualifiées par la table, comme dans le `delete` réel.
    const result = await db.query<{ id: string }>(`select id from source_records where ${sql}`, params);
    const ids = new Set(result.rows.map((r) => r.id));

    expect(ids).toEqual(new Set([throttled, timeout, nonJson, exception, nullStatus]));
    expect(ids.has(ok)).toBe(false);
    expect(ids.has(withEvidence)).toBe(false); // preuve rattachée : jamais supprimée
    expect(ids.has(otherSource)).toBe(false); // autre source
    expect(ids.has(otherCase)).toBe(false); // autre dossier
  });
});
