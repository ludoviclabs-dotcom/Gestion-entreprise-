import { describe, it, expect } from "vitest";
import {
  normalizePappers,
  pappersDirigeants,
} from "@/lib/ingestion/normalize-pappers";
import { inferEntitySource, inferEdgeSource } from "@/lib/data/case-quality";
import type { CaseBundle, CaseEntity } from "@/lib/graph/graph-types";

const COMPANY = "co:123456789";

// Données SYNTHÉTIQUES (aucune personne réelle).
const apiShape = {
  representants: [
    {
      prenom: "Alice",
      nom: "EXEMPLE",
      qualite: "Présidente",
      personne_morale: false,
      date_de_naissance_formate: "mars 1970",
    },
    {
      denomination: "HOLDING FICTIVE SAS",
      siren: "987 654 321",
      qualite: "Administrateur",
      personne_morale: true,
    },
    { nom_complet: "Bob TEST", qualite: "Directeur général" },
    { qualite: "Sans nom" },
  ],
  beneficiaires_effectifs: [{ nom: "SECRET", prenom: "Ubo", pourcentage_parts: 40 }],
};

describe("pappersDirigeants", () => {
  it("lit la forme API (`representants`) : personnes physiques et morales", () => {
    const { entities, edges } = pappersDirigeants(apiShape, COMPANY);
    expect(entities.map((e) => e.id).sort()).toEqual(
      ["co:987654321", "pe:alice-exemple", "pe:bob-test"].sort(),
    );
    const alice = entities.find((e) => e.id === "pe:alice-exemple");
    expect(alice).toMatchObject({
      type: "person",
      label: "Alice EXEMPLE",
      evidenceLevel: "declared",
      attributes: { Qualité: "Présidente" },
    });
    const holding = entities.find((e) => e.id === "co:987654321");
    expect(holding).toMatchObject({ type: "company", attributes: { SIREN: "987654321" } });
    expect(edges.every((e) => e.type === "DIRIGE" && e.target === COMPANY)).toBe(true);
    expect(edges).toHaveLength(3);
  });

  it("lit aussi la forme historique (`dirigeants`) et dédoublonne", () => {
    const { entities } = pappersDirigeants(
      {
        dirigeants: [{ prenom: "Alice", nom: "EXEMPLE", qualite: "Présidente" }],
        representants: [{ prenom: "Alice", nom: "EXEMPLE", qualite: "Présidente" }],
      },
      COMPANY,
    );
    expect(entities).toHaveLength(1);
  });

  it("n'expose NI les bénéficiaires effectifs NI la date de naissance", () => {
    const { entities } = pappersDirigeants(apiShape, COMPANY);
    const dump = JSON.stringify(entities);
    expect(dump).not.toContain("SECRET");
    expect(dump).not.toContain("1970");
  });

  it("ne lève jamais sur une réponse vide ou inattendue", () => {
    for (const bad of [null, undefined, {}, "x", { representants: "pas un tableau" }]) {
      expect(pappersDirigeants(bad, COMPANY)).toEqual({ entities: [], edges: [] });
    }
  });

  it("attribue la preuve à Pappers (et non à l'INPI ou Sirene)", () => {
    const { entities, edges } = pappersDirigeants(apiShape, COMPANY);
    expect(inferEntitySource(entities[0])).toBe("pappers");
    const company: CaseEntity = {
      id: COMPANY,
      type: "company",
      label: "SOCIETE",
      evidenceLevel: "declared",
      source: "INSEE Sirene",
    };
    const bundle = {
      entities: [company, ...entities],
      edges,
    } as unknown as CaseBundle;
    expect(inferEdgeSource(edges[0], bundle)).toBe("pappers");
  });
});

describe("normalizePappers (comptes annuels)", () => {
  it("enrichit le nœud société avec le dernier exercice", () => {
    const entities: CaseEntity[] = [
      { id: COMPANY, type: "company", label: "SOCIETE", evidenceLevel: "declared" },
    ];
    const res = normalizePappers(
      {
        finances: [
          { annee: 2021, chiffre_affaires: 1, resultat_net: 1, capitaux_propres: 1, effectif: 1 },
          { annee: 2022, chiffre_affaires: 2000, resultat_net: 300, capitaux_propres: 5000, effectif: 12 },
        ],
      },
      COMPANY,
      entities,
    );
    expect(res.finances?.annee).toBe(2022);
    expect(entities[0].attributes?.["Résultat net"]).toContain("(2022)");
    expect(entities[0].attributes?.["Source des comptes"]).toBe("Pappers");
  });

  it("remplace les comptes d'une autre source ET sa mention de provenance (aucun mélange)", () => {
    const entities: CaseEntity[] = [
      {
        id: COMPANY,
        type: "company",
        label: "SOCIETE",
        evidenceLevel: "declared",
        attributes: {
          "CA (dernier exercice)": "9 € (2024)",
          "Résultat net": "9 € (2024)",
          "Source des comptes": "Recherche d'entreprises (DINUM)",
          "Indicateurs publics": "Qualiopi",
        },
      },
    ];
    // Pappers ne publie PAS de résultat net : l'ancien (DINUM, 2024) ne doit pas rester.
    normalizePappers(
      { finances: [{ annee: 2023, chiffre_affaires: 5000, resultat_net: null, capitaux_propres: 1000, effectif: 3 }] },
      COMPANY,
      entities,
    );
    const a = entities[0].attributes ?? {};
    expect(a["Source des comptes"]).toBe("Pappers");
    expect(a["CA (dernier exercice)"]).toContain("(2023)");
    expect(a["Résultat net"]).toBeUndefined();
    // Les attributs sans rapport avec les comptes sont conservés.
    expect(a["Indicateurs publics"]).toBe("Qualiopi");
  });

  it("sans comptes Pappers : ne touche pas aux comptes d'une autre source", () => {
    const entities: CaseEntity[] = [
      {
        id: COMPANY,
        type: "company",
        label: "SOCIETE",
        evidenceLevel: "declared",
        attributes: {
          "CA (dernier exercice)": "9 € (2024)",
          "Source des comptes": "Recherche d'entreprises (DINUM)",
        },
      },
    ];
    normalizePappers({ finances: [] }, COMPANY, entities);
    expect(entities[0].attributes?.["Source des comptes"]).toBe("Recherche d'entreprises (DINUM)");
    expect(entities[0].attributes?.["CA (dernier exercice)"]).toBe("9 € (2024)");
  });
});
