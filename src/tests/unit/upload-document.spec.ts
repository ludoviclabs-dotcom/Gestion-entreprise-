import { describe, expect, it } from "vitest";
import { FixtureCasesRepository } from "@/lib/data/fixture-repository";
import { docling } from "@/lib/connectors/docling";
import { normalizeDocling } from "@/lib/ingestion/normalize-docling";

/**
 * Vérifie le pipeline d'ajout de document (Docling) de bout en bout, en mode
 * session/fixture (sans service Python) : extraction → normalisation → fusion
 * (résolution d'entités) → journalisation de la source.
 */
describe("ajout de document (Docling, mode session)", () => {
  it("fusionne l'extraction dans un dossier de session et journalise la source", async () => {
    const repo = new FixtureCasesRepository();
    const summary = await repo.createCaseFromSiren("123456789");
    const before = await repo.getCase(summary.id);
    const beforeEntities = before!.bundle.entities.length;

    // Extraction (fixture en démo — le fichier est ignoré) + normalisation.
    const extraction = await docling.extract({
      name: "kbis.pdf",
    } as unknown as File);
    expect(extraction.isFixture).toBe(true);
    const extracted = normalizeDocling(extraction.raw);
    expect(extracted.entities.length).toBeGreaterThan(0);

    const result = await repo.addSourceDocument(
      summary.id,
      {
        source: "docling",
        endpoint: extraction.endpoint,
        httpStatus: extraction.httpStatus,
        raw: extraction.raw,
        isFixture: extraction.isFixture,
      },
      extracted,
    );
    expect(result.entities).toBeGreaterThan(beforeEntities);

    const after = await repo.getCase(summary.id);
    expect(after!.sources.some((s) => s.source === "docling")).toBe(true);

    const events = await repo.listProofEvents(summary.id);
    expect(events.some((e) => e.kind === "source_consultee")).toBe(true);
  });

  it("rejette l'ajout sur un dossier inexistant", async () => {
    const repo = new FixtureCasesRepository();
    await expect(
      repo.addSourceDocument(
        "inexistant",
        {
          source: "docling",
          endpoint: "fixture:docling",
          httpStatus: 0,
          raw: {},
          isFixture: true,
        },
        { entities: [], edges: [] },
      ),
    ).rejects.toThrow();
  });
});
