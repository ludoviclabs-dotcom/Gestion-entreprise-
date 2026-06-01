import { describe, it, expect } from "vitest";
import { assembleCase } from "@/lib/ingestion/assemble-case";

// Mode démo par défaut (NEXT_PUBLIC_DEMO_MODE non défini) → connecteurs en fixtures.
describe("assembleCase (mode mock)", () => {
  it("assemble un dossier complet depuis les fixtures", async () => {
    const { bundle, sources } = await assembleCase("552032534");

    expect(bundle.case.title).toBe("DANONE");
    expect(bundle.case.rootSiren).toBe("552032534");

    const types = new Set(bundle.entities.map((e) => e.type));
    expect(types.has("company")).toBe(true);
    expect(types.has("person")).toBe(true); // dirigeants INPI
    expect(types.has("address")).toBe(true); // siège Sirene
    expect(types.has("sanction")).toBe(true); // correspondance gels (simulée)

    expect(bundle.edges.some((e) => e.type === "DIRIGE")).toBe(true);
    expect(bundle.edges.some((e) => e.type === "EST_VISE_PAR")).toBe(true);
    expect(bundle.events.length).toBeGreaterThan(0);

    // La correspondance gels reste une hypothèse, jamais un fait.
    const sanction = bundle.entities.find((e) => e.type === "sanction");
    expect(sanction?.evidenceLevel).toBe("simulated");

    // Traçabilité : un source_record par appel connecteur.
    expect(sources.length).toBeGreaterThanOrEqual(5);
  });
});
