import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CaseEdge } from "@/lib/graph/graph-types";
import { edgeAttributes, readEdgeAttributes } from "@/lib/data/edge-attributes";

describe("DbCasesRepository persistence contract", () => {
  it("persiste les validites temporelles et raccorde evidence aux source_records", () => {
    const source = readFileSync("src/lib/data/db-repository.ts", "utf8");

    expect(source).toContain("validFrom: edge.validFrom ?? null");
    expect(source).toContain("validTo: edge.validTo ?? null");
    expect(source).toContain(".insert(sourceRecords)");
    expect(source).toContain(".insert(evidence)");
    expect(source).toContain("sourceRecordIdFor(");
    expect(source).toContain("scoreModelVersion: SCORE_MODEL_VERSION");
    // Lecture : la version persistée du dossier est restituée, jamais la courante.
    expect(source).toContain("scoreModelVersion: scoreModelVersionOf(caseRow.metadata)");
    expect(source).toContain("attributes: edgeAttributes(edge)");
    expect(source).toContain("readEdgeAttributes(e.attributes)");
  });

  it("conserve droits de vote et droits particuliers d'un lien dans ses attributs", () => {
    const edge: CaseEdge = {
      id: "e1",
      type: "DETIENT",
      source: "h",
      target: "s",
      weight: "40 %",
      votingWeight: "60 %",
      specialRights: "Veto sur la cession du brevet",
      label: "Détient",
      evidenceLevel: "declared",
    };
    // Aller-retour par JSON, comme une colonne jsonb.
    const back = readEdgeAttributes(JSON.parse(JSON.stringify(edgeAttributes(edge))));
    expect(back).toEqual({ label: "Détient", excerpt: undefined, votingWeight: "60 %", specialRights: "Veto sur la cession du brevet" });
    expect(readEdgeAttributes(null)).toEqual({ label: undefined, excerpt: undefined, votingWeight: undefined, specialRights: undefined });
  });

  it("journalise la création et les synthèses dans audit_logs (chaîne de hash)", () => {
    const source = readFileSync("src/lib/data/db-repository.ts", "utf8");

    expect(source).toContain(".insert(auditLogs)");
    expect(source).toContain("buildCreationProofEvents");
    expect(source).toContain("prevHash: entry.prevHash");
    expect(source).toContain("entryHash: entry.entryHash");
    expect(source).toContain('"synthese_enregistree"');
  });
});
