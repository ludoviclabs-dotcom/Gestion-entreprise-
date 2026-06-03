import { describe, it, expect } from "vitest";
import { normalizeInpi } from "@/lib/ingestion/normalize-inpi";

const COMPANY_ID = "co:552032534";

describe("normalizeInpi", () => {
  it("mappe un dirigeant personne physique en nœud person + arête DIRIGE", () => {
    const { entities, edges } = normalizeInpi(
      { dirigeants: [{ nom: "FABER", prenoms: "Emmanuel", qualite: "DG" }] },
      COMPANY_ID,
    );
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("person");
    expect(entities[0].label).toBe("Emmanuel FABER");
    expect(edges[0].type).toBe("DIRIGE");
    expect(edges[0].target).toBe(COMPANY_ID);
    expect(edges[0].evidenceLevel).toBe("declared");
  });

  it("mappe un dirigeant personne morale en nœud company avec SIREN", () => {
    const { entities, edges } = normalizeInpi(
      {
        dirigeants: [
          {
            type: "personne_morale",
            denomination: "SOFINA HOLDING",
            siren: "999888777",
            qualite: "Administrateur",
          },
        ],
      },
      COMPANY_ID,
    );
    expect(entities).toHaveLength(1);
    expect(entities[0].type).toBe("company");
    expect(entities[0].id).toBe("co:999888777");
    expect(entities[0].attributes?.SIREN).toBe("999888777");
    expect(edges[0].type).toBe("DIRIGE");
  });

  it("n'expose PAS les bénéficiaires effectifs par défaut (garde-fou CJUE)", () => {
    const { entities, edges } = normalizeInpi(
      {
        dirigeants: [],
        beneficiairesEffectifs: [
          { nom: "DUPONT", prenoms: "Marie", modaliteControle: "27%" },
        ],
      },
      COMPANY_ID,
    );
    // INPI_EXPOSE_UBO défaut "false" → aucun UBO rendu.
    expect(entities).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("ne lève pas sur une entrée vide", () => {
    expect(() => normalizeInpi({}, COMPANY_ID)).not.toThrow();
    expect(() => normalizeInpi(null, COMPANY_ID)).not.toThrow();
  });
});
