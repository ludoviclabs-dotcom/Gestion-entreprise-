import { describe, it, expect } from "vitest";
import { getConnectorStatuses, isLiveMode } from "@/lib/connectors/status";

/**
 * En environnement de test, NEXT_PUBLIC_DEMO_MODE n'est pas "false" → mode démo.
 * Tous les connecteurs externes doivent donc être marqués non-live (fixtures),
 * indépendamment des clés. Seule la ligne « base de données » dépend de
 * DATABASE_URL (et non du mode démo).
 */
describe("getConnectorStatuses", () => {
  const statuses = getConnectorStatuses();
  const byKey = Object.fromEntries(statuses.map((s) => [s.key, s]));

  it("couvre les 6 connecteurs attendus", () => {
    expect(statuses.map((s) => s.key).sort()).toEqual(
      ["bodacc", "database", "inpi", "opensanctions", "sirene", "tresor"].sort(),
    );
  });

  it("marque tous les connecteurs externes non-live en mode démo", () => {
    for (const key of ["sirene", "bodacc", "tresor", "opensanctions", "inpi"]) {
      expect(byKey[key].live, `${key} doit être démo en test`).toBe(false);
    }
  });

  it("aligne le statut BDD sur la présence de DATABASE_URL", () => {
    expect(byKey.database.live).toBe(Boolean(process.env.DATABASE_URL));
  });

  it("chaque statut porte un libellé et un détail non vides", () => {
    for (const s of statuses) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.detail.length).toBeGreaterThan(0);
    }
  });

  it("isLiveMode reflète le mode démo (false en test)", () => {
    expect(isLiveMode()).toBe(false);
  });

  it("signale le screening auto-hébergé (yente) sans ajouter de connecteur", () => {
    const prev = process.env.OPENSANCTIONS_SELF_HOSTED;
    process.env.OPENSANCTIONS_SELF_HOSTED = "true";
    try {
      const selfHosted = getConnectorStatuses();
      expect(selfHosted).toHaveLength(6);
      const os = selfHosted.find((s) => s.key === "opensanctions");
      expect(os?.detail).toMatch(/yente/i);
    } finally {
      if (prev === undefined) delete process.env.OPENSANCTIONS_SELF_HOSTED;
      else process.env.OPENSANCTIONS_SELF_HOSTED = prev;
    }
  });
});
