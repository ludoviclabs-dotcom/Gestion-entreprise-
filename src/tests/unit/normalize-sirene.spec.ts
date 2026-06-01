import { describe, it, expect } from "vitest";
import ul from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etab from "@/lib/fixtures/sirene-etablissement.sample.json";
import { normalizeSirene } from "@/lib/ingestion/normalize-sirene";

describe("normalizeSirene", () => {
  const r = normalizeSirene(ul, etab);

  it("crée une entité société confirmée", () => {
    const company = r.entities.find((e) => e.type === "company");
    expect(company?.label).toBe("DANONE");
    expect(company?.evidenceLevel).toBe("confirmed");
  });

  it("crée une adresse de siège et un lien", () => {
    expect(r.entities.some((e) => e.type === "address")).toBe(true);
    expect(r.edges.some((e) => e.type === "PARTAGE_ADRESSE")).toBe(true);
  });

  it("expose dénomination et nic", () => {
    expect(r.denomination).toBe("DANONE");
    expect(r.nic).toBe("00046");
  });
});
