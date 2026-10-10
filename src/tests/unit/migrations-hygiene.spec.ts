import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Garde-fou : un fichier de migration commençant par un BOM UTF-8 (EF BB BF) est
 * envoyé tel quel à PostgreSQL, qui ne le tient pas pour un espace → échec au
 * premier jeton et migration jamais appliquée. Cela arrive dès qu'un fichier est
 * écrit par un outil Windows (`Set-Content -Encoding utf8`, certains éditeurs).
 */
describe("migrations drizzle", () => {
  const dir = path.join(process.cwd(), "drizzle");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));

  it("trouve des migrations", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("aucun fichier .sql ne commence par un BOM UTF-8", () => {
    const withBom = files.filter((f) => {
      const b = fs.readFileSync(path.join(dir, f));
      return b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
    });
    expect(withBom).toEqual([]);
  });

  it("chaque ajout de valeur d'enum est idempotent depuis la migration 0009", () => {
    const recent = files.filter((f) => Number(f.slice(0, 4)) >= 9);
    for (const f of recent) {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      for (const stmt of sql.split(";")) {
        if (/ADD VALUE/i.test(stmt)) {
          expect(stmt, `${f} : ADD VALUE doit être « IF NOT EXISTS »`).toMatch(/IF NOT EXISTS/i);
        }
      }
    }
  });
});
