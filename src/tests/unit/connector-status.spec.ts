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

  it("couvre les 9 connecteurs attendus", () => {
    expect(statuses.map((s) => s.key).sort()).toEqual(
      ["ban", "bodacc", "database", "gleif", "inpi", "opensanctions", "sirene", "tresor", "vies"].sort(),
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
});
