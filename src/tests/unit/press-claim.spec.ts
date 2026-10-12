import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { pressStateIs } from "@/lib/data/press-sql";

vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));

/**
 * La prise de possession d'une reprise est ATOMIQUE : deux relances simultanées lisent
 * le même état, mais une seule met à jour une ligne. Exécuté sur PostgreSQL réel.
 */
describe("pressStateIs — prise de possession atomique", () => {
  let db: PGlite;
  const dialect = new PgDialect();
  const ID = "11111111-2222-4333-8444-555555555555";

  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create table cases (id uuid primary key, metadata jsonb);");
  }, 60_000);
  afterAll(async () => {
    await db.close();
  });

  const seed = (press: Record<string, unknown> | null) =>
    db.query(
      "insert into cases (id, metadata) values ($1, $2::jsonb) on conflict (id) do update set metadata = excluded.metadata",
      [ID, JSON.stringify(press ? { press } : {})],
    );

  /** Tente la prise de possession avec l'état LU ; renvoie le nombre de lignes mises à jour. */
  const claim = async (read: { state: "pending" | "done" | "failed"; requestedAt?: string }) => {
    const cond = dialect.sqlToQuery(pressStateIs(read));
    // Les paramètres de la condition sont décalés de 2 (jsonb du nouvel état, id).
    const shifted = cond.sql.replace(/\$(\d+)/g, (_m, n: string) => "$" + (Number(n) + 2));
    const res = await db.query(
      `update cases set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{press}', $1::jsonb)
       where id = $2 and ${shifted} returning id`,
      [JSON.stringify({ state: "pending", requestedAt: new Date().toISOString() }), ID, ...cond.params],
    );
    return res.rows.length;
  };

  it("deux relances qui lisent le même état « failed » : UNE seule l'emporte", async () => {
    await seed({ state: "failed", requestedAt: "2026-10-12T10:00:00.000Z" });
    const first = await claim({ state: "failed", requestedAt: "2026-10-12T10:00:00.000Z" });
    const second = await claim({ state: "failed", requestedAt: "2026-10-12T10:00:00.000Z" });
    expect([first, second]).toEqual([1, 0]);
  });

  it("état « done » sans horodatage lu : la condition tient, une seule l'emporte", async () => {
    await seed({ state: "done" });
    const first = await claim({ state: "done" });
    const second = await claim({ state: "done" });
    expect([first, second]).toEqual([1, 0]);
  });

  it("l'état a changé entre la lecture et la mise à jour : aucune ligne", async () => {
    await seed({ state: "pending", requestedAt: "2026-10-12T11:00:00.000Z" });
    expect(await claim({ state: "failed", requestedAt: "2026-10-12T10:00:00.000Z" })).toBe(0);
  });
});
