import { describe, expect, it } from "vitest";
import { redactCaseDetail } from "@/lib/export/redaction";
import { buildBundleEvidence } from "@/lib/data/case-quality";
import { fixtureCasesById } from "@/lib/fixtures/cases";
import type { CaseDetail } from "@/lib/data/types";

function detailFor(caseId: string): CaseDetail {
  const fx = fixtureCasesById.get(caseId)!;
  return {
    bundle: fx.bundle,
    sources: fx.sources,
    evidence: buildBundleEvidence(fx.bundle, fx.sources),
  };
}

describe("redaction-light des exports (?redact=persons)", () => {
  it("aucun nom de personne ne survit (entités + UBO déclarés)", () => {
    const redacted = redactCaseDetail(detailFor("holding-ubo"));
    const json = JSON.stringify(redacted);

    // Personnes du graphe + nominee déclaré uniquement au registre (LEROY).
    for (const fragment of [
      "MOREAU",
      "Hélène",
      "BENALI",
      "Karim",
      "HADDAD",
      "Sofia",
      "PETIT",
      "Olivier",
      "LEROY",
      "Vincent",
    ]) {
      expect(json).not.toContain(fragment);
    }
    expect(json).toContain("Personne #1");
  });

  it("déterministe et alias stables par ordre d'apparition", () => {
    const a = redactCaseDetail(detailFor("holding-ubo"));
    const b = redactCaseDetail(detailFor("holding-ubo"));
    expect(a).toEqual(b);

    const persons = a.bundle.entities.filter((e) => e.type === "person");
    expect(persons.map((p) => p.label)).toEqual(
      persons.map((_, i) => `Personne #${i + 1}`),
    );
  });

  it("les sociétés éponymes sont sur-masquées (assumé)", () => {
    const redacted = redactCaseDetail(detailFor("demo-holding"));
    const json = JSON.stringify(redacted);
    // « Jean MARTIN » (personne) ET « MARTIN HOLDING LTD » (société éponyme).
    expect(json).not.toContain("MARTIN");
  });

  it("détail sans personne : renvoyé tel quel", () => {
    const detail = detailFor("holding-ubo");
    const noPersons: CaseDetail = {
      ...detail,
      bundle: {
        ...detail.bundle,
        entities: detail.bundle.entities.filter((e) => e.type !== "person"),
        declaredUbo: undefined,
      },
    };
    expect(redactCaseDetail(noPersons)).toBe(noPersons);
  });
});
