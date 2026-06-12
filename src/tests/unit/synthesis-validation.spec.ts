import { describe, expect, it } from "vitest";
import {
  referencedRuleIds,
  validateSynthesisReferences,
} from "@/lib/synthesis/validate";
import { buildBriefing } from "@/lib/synthesis/briefing";
import { fixtureCasesById } from "@/lib/fixtures/cases";

const holdingUbo = fixtureCasesById.get("holding-ubo")!.bundle;
const sansSignal = {
  ...holdingUbo,
  riskSignals: [],
};

describe("validation des références de synthèse (consigne 3)", () => {
  it("accepte une synthèse citant une règle déclenchée", () => {
    const content =
      "Synthèse : structure de détention fragmentée. Éléments de vigilance : ECART_UBO_DECLARE signale 2 divergences registre/capital. À vérifier : extrait RBE récent.";
    const result = validateSynthesisReferences(content, holdingUbo);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.referencedRuleIds).toContain("ECART_UBO_DECLARE");
    }
  });

  it("rejette une synthèse sans aucun identifiant de règle", () => {
    const content =
      "Synthèse : tout va bien. Éléments de vigilance : aucun. À vérifier : rien de particulier.";
    const result = validateSynthesisReferences(content, holdingUbo);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ECART_UBO_DECLARE");
    }
  });

  it("passe sans citation quand le dossier n'a aucun signal", () => {
    const result = validateSynthesisReferences(
      "Synthèse : dossier sans signal de vigilance détecté.",
      sansSignal,
    );
    expect(result).toEqual({ ok: true, referencedRuleIds: [] });
  });

  it("referencedRuleIds ne retient que les règles réellement déclenchées", () => {
    const content =
      "ECART_UBO_DECLARE confirmé ; PROCEDURE_COLLECTIVE non applicable ici.";
    // holding-ubo ne déclenche pas PROCEDURE_COLLECTIVE.
    expect(referencedRuleIds(content, holdingUbo)).toEqual([
      "ECART_UBO_DECLARE",
    ]);
  });
});

describe("briefing durci", () => {
  it("annonce le rejet sans identifiant et liste les sources consultées", () => {
    const briefing = buildBriefing(holdingUbo, [
      {
        source: "inpi",
        endpoint: "fixture:inpi",
        payloadHash: "a".repeat(64),
      },
    ]);
    expect(briefing).toContain("identifiants EXACTS");
    expect(briefing).toContain("REJETÉE à l'enregistrement");
    expect(briefing).toContain("## Sources consultées");
    expect(briefing).toContain("fixture:inpi");
    expect(briefing).toContain("aaaaaaaaaaaa…"); // empreinte tronquée à 12
  });

  it("reste rétro-compatible sans sources", () => {
    const briefing = buildBriefing(holdingUbo);
    expect(briefing).not.toContain("## Sources consultées");
    expect(briefing).toContain("## Signaux de vigilance détectés");
  });
});
