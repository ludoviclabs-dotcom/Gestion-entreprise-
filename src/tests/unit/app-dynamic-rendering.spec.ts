import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * Régression : `/cases` et `/dashboard` lisent la base mais n'utilisent ni
 * cookies ni en-têtes — Next les prérend alors au build et la liste reste figée
 * au dernier déploiement (un dossier créé n'y apparaît pas). Le layout du shell
 * doit donc forcer le rendu à chaque requête.
 */
describe("shell applicatif — rendu dynamique", () => {
  it("le layout (app) force le rendu dynamique", () => {
    const layout = read("src/app/(app)/layout.tsx");
    expect(layout).toMatch(/export const dynamic = "force-dynamic";/);
  });

  it("aucune page du shell ne repasse en rendu statique", () => {
    for (const rel of [
      "src/app/(app)/layout.tsx",
      "src/app/(app)/cases/page.tsx",
      "src/app/(app)/dashboard/page.tsx",
    ]) {
      expect(read(rel)).not.toMatch(/export const dynamic = ["']force-static["']/);
      expect(read(rel)).not.toMatch(/export const revalidate = [1-9]/);
    }
  });
});
