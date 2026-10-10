import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runSources } from "../../../scripts/import/lib/run-sources";

describe("imports indépendants", () => {
  it("poursuit ICPE après un échec Camino et échoue globalement sans exposer l'erreur", async () => {
    const run = vi.fn(async (source: string) => {
      if (source === "camino") throw new Error("PRIVATE_DATABASE_URL");
    });
    const report = vi.fn(async () => {});
    await expect(runSources(["camino", "icpe"], run, report)).rejects.toThrow("ONE_OR_MORE_IMPORTS_FAILED");
    expect(run.mock.calls.map(c => c[0])).toEqual(["camino", "icpe"]);
    expect(report).toHaveBeenCalledWith("camino : import en échec ; la dernière version validée est conservée.");
    expect(JSON.stringify(report.mock.calls)).not.toContain("PRIVATE_DATABASE_URL");
  });
  it("réussit si tous les imports réussissent et accepte check sans import", async () => {
    const run = vi.fn(async () => {}), report = vi.fn(async () => {});
    await expect(runSources(["camino", "icpe"], run, report)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(2);
    await runSources([], run, report);
    expect(run).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });
  it("rapporte chaque échec même si l'écriture du résumé échoue", async () => {
    const run = vi.fn(async () => { throw new Error("unavailable"); });
    const report = vi.fn(async () => { throw new Error("summary unavailable"); });
    await expect(runSources(["camino", "icpe"], run, report)).rejects.toThrow("ONE_OR_MORE_IMPORTS_FAILED");
    expect(run).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledTimes(2);
  });
  it("laisse aux deux imports séquentiels leur budget plus une marge de préparation", () => {
    const workflow = readFileSync(".github/workflows/import-open-data.yml", "utf8");
    const timeout = Number(workflow.match(/timeout-minutes:\s*(\d+)/)?.[1]);
    expect(timeout).toBeGreaterThanOrEqual(2 * 25 + 10);
  });
});
