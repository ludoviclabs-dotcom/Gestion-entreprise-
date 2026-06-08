import { describe, expect, it } from "vitest";
import { curateCaseSummaries } from "@/lib/data/case-curation";
import type { CaseSummary } from "@/lib/data/types";

function summary(overrides: Partial<CaseSummary>): CaseSummary {
  return {
    id: "case-a",
    title: "Case A",
    rootSiren: "123456789",
    status: "ready",
    origin: "live",
    scoreStatus: "computed",
    sourceHealth: { origin: "live", total: 2, live: 2, fixture: 0, failed: 0 },
    scores: { complexite: 10, vigilance: 20, qualitePreuve: 90 },
    counts: { entities: 3, edges: 2, signalsHigh: 0 },
    lastRunAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("curateCaseSummaries", () => {
  it("masque les erreurs et garde la meilleure version par SIREN", () => {
    const result = curateCaseSummaries([
      summary({ id: "old", scoreStatus: "partial", updatedAt: "2026-06-01T00:00:00.000Z" }),
      summary({ id: "best", updatedAt: "2026-06-02T00:00:00.000Z" }),
      summary({ id: "error", status: "error", scoreStatus: "error" }),
      summary({
        id: "demo-holding",
        rootSiren: "987654321",
        origin: "fixture",
        sourceHealth: {
          origin: "fixture",
          total: 3,
          live: 0,
          fixture: 3,
          failed: 0,
        },
      }),
    ]);

    expect(result.visible.map((item) => item.id)).toEqual([
      "demo-holding",
      "best",
    ]);
    expect(result.hidden.map((item) => item.id).sort()).toEqual([
      "error",
      "old",
    ]);
    expect(result.hiddenErrors).toBe(1);
    expect(result.hiddenDuplicates).toBe(1);
  });
});
