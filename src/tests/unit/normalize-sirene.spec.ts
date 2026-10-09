import { describe, it, expect } from "vitest";
import ul from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etab from "@/lib/fixtures/sirene-etablissement.sample.json";
import { normalizeSirene, sireneAddress } from "@/lib/ingestion/normalize-sirene";

describe("normalizeSirene", () => {
  const r = normalizeSirene(ul, etab);

  it("crée une entité société confirmée", () => {
    const company = r.entities.find((e) => e.type === "company");
    expect(company?.label).toBe("DANONE");
    expect(company?.evidenceLevel).toBe("confirmed");
  });

  it("crée une adresse de siège et un lien", () => {
    expect(r.entities.some((e) => e.type === "address")).toBe(true);
    expect(r.edges.some((e) => e.type === "PARTAGE_ADRESSE")).toBe(true);
  });

  it("expose dénomination et nic", () => {
    expect(r.denomination).toBe("DANONE");
    expect(r.nic).toBe("00046");
  });
});

/**
 * Formes réelles de l'API Sirene 3.11, relevées sur des appels live (données
 * publiques d'une grande société) : le NIC du siège est porté par la PÉRIODE, et
 * la recherche `/siret?q=` renvoie `etablissements[]` (et non `etablissement`).
 */
describe("normalizeSirene — réponses réelles de l'API 3.11", () => {
  const liveUl = {
    header: { statut: 200, message: "OK" },
    uniteLegale: {
      siren: "552081317",
      dateCreationUniteLegale: "1955-01-01",
      periodesUniteLegale: [
        {
          etatAdministratifUniteLegale: "A",
          denominationUniteLegale: "ELECTRICITE DE FRANCE",
          categorieJuridiqueUniteLegale: "5599",
          nicSiegeUniteLegale: "66522",
          activitePrincipaleUniteLegale: "35.11Z",
        },
      ],
    },
  };
  const searchResponse = {
    header: { statut: 200, message: "OK", total: 1, debut: 0, nombre: 1 },
    etablissements: [
      {
        siren: "552081317",
        nic: "66522",
        etablissementSiege: true,
        adresseEtablissement: {
          numeroVoieEtablissement: "22",
          typeVoieEtablissement: "AVENUE",
          libelleVoieEtablissement: "DE WAGRAM",
          codePostalEtablissement: "75008",
          libelleCommuneEtablissement: "PARIS",
        },
      },
    ],
  };

  it("lit le NIC du siège dans la période (et non au niveau 1)", () => {
    expect(normalizeSirene(liveUl, {}).nic).toBe("66522");
  });

  it("lit l'adresse d'une réponse de recherche (`etablissements[0]`)", () => {
    const addr = sireneAddress(searchResponse);
    expect(addr).toEqual({
      label: "22 AVENUE DE WAGRAM, 75008 PARIS",
      postcode: "75008",
      city: "PARIS",
    });
    const r = normalizeSirene(liveUl, searchResponse);
    expect(r.entities.some((e) => e.type === "address")).toBe(true);
    expect(r.edges.some((e) => e.type === "PARTAGE_ADRESSE")).toBe(true);
  });

  it("ne lève jamais sur une réponse établissement vide ou inattendue", () => {
    for (const bad of [null, undefined, {}, "x", { etablissements: [] }]) {
      expect(sireneAddress(bad)).toBeNull();
    }
  });

  it("affiche la bonne forme juridique (5599 = SA, 5710 = SAS) et le code brut si inconnu", () => {
    const withCode = (code: string) =>
      normalizeSirene(
        { uniteLegale: { siren: "1", periodesUniteLegale: [{ categorieJuridiqueUniteLegale: code }] } },
        {},
      ).entities[0].attributes?.["Forme juridique"];
    expect(withCode("5599")).toBe("SA");
    expect(withCode("5710")).toBe("SAS");
    expect(withCode("5499")).toBe("SARL");
    expect(withCode("1234")).toBe("1234");
  });
});
