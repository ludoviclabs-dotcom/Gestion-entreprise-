import { describe, it, expect } from "vitest";
import { normalizeGdelt } from "@/lib/ingestion/normalize-gdelt";
import type { CaseEntity } from "@/lib/graph/graph-types";

const entities: CaseEntity[] = [
  { id: "co:552032534", type: "company", label: "DANONE", evidenceLevel: "confirmed" },
  { id: "pe:jean-martin", type: "person", label: "Jean Martin", evidenceLevel: "declared" },
];

describe("normalizeGdelt", () => {
  it("apparie un article au sujet et l'horodate (preuve inférée)", () => {
    const events = normalizeGdelt(
      {
        articles: [
          { title: "Danone publie ses résultats", domain: "presse.fr", seendate: "20260512T101500Z", tone: 0.5 },
        ],
      },
      { subjectId: "co:552032534", entities },
    );
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe("co:552032534");
    expect(events[0].kind).toBe("couverture_media");
    expect(events[0].evidenceLevel).toBe("inferred");
    expect(events[0].occurredOn).toBe("2026-05-12");
  });

  it("marque défavorable un article à tonalité négative", () => {
    const events = normalizeGdelt(
      { articles: [{ title: "Enquête visant Danone", tone: -7.5, seendate: "20260101T000000Z" }] },
      { subjectId: "co:552032534", entities },
    );
    expect(events[0].kind).toBe("couverture_media_defavorable");
  });

  it("apparie nominativement un dirigeant cité dans le titre", () => {
    const events = normalizeGdelt(
      { articles: [{ title: "Jean Martin nommé au conseil", tone: 0 }] },
      { subjectId: "co:552032534", entities },
    );
    expect(events.some((e) => e.entityId === "pe:jean-martin")).toBe(true);
    expect(events.every((e) => e.entityId !== "co:552032534")).toBe(true);
  });

  it("rattache au sujet à défaut d'appariement nominatif dans le titre", () => {
    const events = normalizeGdelt(
      { articles: [{ title: "Le secteur agroalimentaire en mutation", tone: 0 }] },
      { subjectId: "co:552032534", entities },
    );
    expect(events).toHaveLength(1);
    expect(events[0].entityId).toBe("co:552032534");
  });

  it("ne lève pas sur une entrée vide ou nulle", () => {
    expect(() => normalizeGdelt(null, { subjectId: "co:1", entities: [] })).not.toThrow();
    expect(normalizeGdelt({ articles: [] }, { subjectId: "co:1", entities })).toHaveLength(0);
  });
});
