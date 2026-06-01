import { describe, it, expect } from "vitest";
import { FixtureCasesRepository } from "@/lib/data/fixture-repository";

describe("FixtureCasesRepository", () => {
  it("liste au moins 5 dossiers de démonstration", async () => {
    const repo = new FixtureCasesRepository();
    const list = await repo.listCases();
    expect(list.length).toBeGreaterThanOrEqual(5);
    // tri par updatedAt desc — la première entrée est la plus récente
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i - 1].updatedAt >= list[i].updatedAt).toBe(true);
    }
  });

  it("rend le bundle complet du dossier holding démo", async () => {
    const repo = new FixtureCasesRepository();
    const detail = await repo.getCase("demo-holding");
    expect(detail).not.toBeNull();
    const bundle = detail!.bundle;
    expect(bundle.case.title).toContain("Holding");
    expect(bundle.entities.length).toBeGreaterThan(0);
    expect(bundle.edges.length).toBeGreaterThan(0);
  });

  it("renvoie null pour un id inconnu", async () => {
    const repo = new FixtureCasesRepository();
    const detail = await repo.getCase("inconnu");
    expect(detail).toBeNull();
  });

  it("recherche des sociétés via les fixtures (mode démo)", async () => {
    const repo = new FixtureCasesRepository();
    const candidates = await repo.searchCompanies("danone");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].siren).toMatch(/^\d{9}$/);
  });

  it("crée un dossier à partir d'un SIREN et le rend accessible (in-memory)", async () => {
    const repo = new FixtureCasesRepository();
    const summary = await repo.createCaseFromSiren("552032534");
    expect(summary.id).toMatch(/^s-552032534-/);
    expect(summary.rootSiren).toBe("552032534");
    expect(summary.status).toBe("draft");

    // Le dossier créé est lisible et apparaît dans la liste.
    const detail = await repo.getCase(summary.id);
    expect(detail).not.toBeNull();
    const list = await repo.listCases();
    expect(list.some((c) => c.id === summary.id)).toBe(true);
  });
});
