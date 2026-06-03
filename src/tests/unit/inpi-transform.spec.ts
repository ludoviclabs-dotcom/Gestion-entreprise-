import { describe, it, expect } from "vitest";
import rawRne from "@/lib/fixtures/inpi-rne-raw.sample.json";
import { transformRne } from "@/lib/connectors/inpi-transform";

describe("transformRne", () => {
  const result = transformRne(rawRne, "552032534");

  it("conserve le SIREN", () => {
    expect(result.siren).toBe("552032534");
  });

  it("extrait les dirigeants personnes physiques avec prénoms concaténés", () => {
    const riboud = result.dirigeants.find((d) => d.nom === "RIBOUD");
    expect(riboud).toBeDefined();
    expect(riboud?.prenoms).toBe("Antoine Marcel");
    expect(riboud?.type).toBe("personne_physique");
    expect(riboud?.qualite).toBe("Président");
  });

  it("mappe les codes de rôle connus", () => {
    const faber = result.dirigeants.find((d) => d.nom === "FABER");
    expect(faber?.qualite).toBe("Directeur général");
  });

  it("extrait les dirigeants personnes morales avec dénomination + SIREN", () => {
    const sofina = result.dirigeants.find(
      (d) => d.type === "personne_morale",
    );
    expect(sofina?.denomination).toBe("SOFINA HOLDING");
    expect(sofina?.siren).toBe("999888777");
    expect(sofina?.qualite).toBe("Membre du conseil d'administration");
  });

  it("extrait les bénéficiaires effectifs avec modalité de contrôle", () => {
    expect(result.beneficiairesEffectifs).toHaveLength(1);
    const ubo = result.beneficiairesEffectifs[0];
    expect(ubo.nom).toBe("DUPONT");
    expect(ubo.prenoms).toBe("Marie Claire");
    expect(ubo.modaliteControle).toBe("27%");
  });

  it("ne lève jamais sur une réponse vide ou malformée", () => {
    expect(() => transformRne(null, "000000000")).not.toThrow();
    expect(() => transformRne({}, "000000000")).not.toThrow();
    expect(() => transformRne({ formality: "garbage" }, "0")).not.toThrow();
    const empty = transformRne({}, "000000000");
    expect(empty.dirigeants).toEqual([]);
    expect(empty.beneficiairesEffectifs).toEqual([]);
  });
});
