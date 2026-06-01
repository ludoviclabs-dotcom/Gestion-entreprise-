import { describe, it, expect } from "vitest";
import bodacc from "@/lib/fixtures/bodacc.sample.json";
import { normalizeBodacc } from "@/lib/ingestion/normalize-bodacc";

describe("normalizeBodacc", () => {
  const events = normalizeBodacc(bodacc, "co:552032534");

  it("mappe chaque avis en événement", () => {
    expect(events).toHaveLength(3);
  });
  it("rattache les événements à la société", () => {
    expect(events.every((e) => e.entityId === "co:552032534")).toBe(true);
  });
  it("détecte les types d'avis", () => {
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("depot_comptes");
    expect(kinds).toContain("creation");
    expect(kinds).toContain("modification");
  });
  it("marque les événements comme confirmés", () => {
    expect(events.every((e) => e.evidenceLevel === "confirmed")).toBe(true);
  });
});
