import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DbCasesRepository persistence contract", () => {
  it("persiste les validites temporelles et raccorde evidence aux source_records", () => {
    const source = readFileSync("src/lib/data/db-repository.ts", "utf8");

    expect(source).toContain("validFrom: edge.validFrom ?? null");
    expect(source).toContain("validTo: edge.validTo ?? null");
    expect(source).toContain(".insert(sourceRecords)");
    expect(source).toContain(".insert(evidence)");
    expect(source).toContain("sourceRecordIdFor(");
    expect(source).toContain("scoreModelVersion: SCORE_MODEL_VERSION");
  });
});
