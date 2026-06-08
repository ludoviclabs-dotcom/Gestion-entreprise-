import { describe, expect, it } from "vitest";
import { SECTOR_THREAT_PROFILES } from "@/lib/domain/sector-threats";

describe("sector threat profiles", () => {
  it("couvre les secteurs prioritaires avec preuves, limites et sources", () => {
    expect(SECTOR_THREAT_PROFILES.length).toBeGreaterThanOrEqual(8);
    const slugs = new Set(SECTOR_THREAT_PROFILES.map((profile) => profile.slug));
    expect(slugs.size).toBe(SECTOR_THREAT_PROFILES.length);

    for (const profile of SECTOR_THREAT_PROFILES) {
      expect(profile.threats2026.length).toBeGreaterThan(0);
      expect(profile.kybSignals.length).toBeGreaterThan(0);
      expect(profile.requiredEvidence.length).toBeGreaterThan(0);
      expect(profile.limitations.length).toBeGreaterThan(0);
      expect(profile.officialSources.length).toBeGreaterThan(0);
      for (const source of profile.officialSources) {
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("evite le vocabulaire accusatoire dans la matrice", () => {
    const text = JSON.stringify(SECTOR_THREAT_PROFILES).toLowerCase();
    expect(text).not.toMatch(/fraude|coupable|criminel/);
  });
});
