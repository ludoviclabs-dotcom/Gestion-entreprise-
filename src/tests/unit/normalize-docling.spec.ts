import { describe, expect, it } from "vitest";
import { normalizeDocling } from "@/lib/ingestion/normalize-docling";
import fixture from "@/lib/fixtures/docling.sample.json";

describe("normalizeDocling", () => {
  it("mappe société, dirigeants et adresse avec des ids fusionnables", () => {
    const { entities, edges } = normalizeDocling(fixture);

    const company = entities.find((e) => e.type === "company");
    expect(company?.id).toBe("co:812345678");
    expect(company?.attributes?.SIREN).toBe("812345678");

    const persons = entities.filter((e) => e.type === "person");
    expect(persons.map((p) => p.id).sort()).toEqual(
      ["pe:claire-martin", "pe:jean-dupont"].sort(),
    );

    const dirige = edges.filter((e) => e.type === "DIRIGE");
    expect(dirige).toHaveLength(2);
    expect(dirige.every((e) => e.target === "co:812345678")).toBe(true);

    expect(entities.some((e) => e.type === "address")).toBe(true);
    expect(edges.some((e) => e.type === "PARTAGE_ADRESSE")).toBe(true);
  });

  it("renvoie un résultat vide sans société exploitable", () => {
    expect(normalizeDocling({}).entities).toHaveLength(0);
    expect(normalizeDocling(null).entities).toHaveLength(0);
  });
});
