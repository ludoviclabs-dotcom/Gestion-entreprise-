import { describe, it, expect } from "vitest";
import { banAddressFrom } from "@/lib/connectors/ban";
import banFixture from "@/lib/fixtures/ban.sample.json";
import { normalizeSirene } from "@/lib/ingestion/normalize-sirene";

const UL = {
  uniteLegale: {
    siren: "111222333",
    nicSiegeUniteLegale: "00046",
    periodesUniteLegale: [
      { denominationUniteLegale: "ACME", activitePrincipaleUniteLegale: "7010Z" },
    ],
  },
};
const ETAB = {
  etablissement: {
    adresseEtablissement: {
      numeroVoieEtablissement: "17",
      typeVoieEtablissement: "BD",
      libelleVoieEtablissement: "HAUSSMANN",
      codePostalEtablissement: "75009",
      libelleCommuneEtablissement: "PARIS 9",
    },
  },
};
const BAN_ADDR = {
  id: "75109_4673_00017",
  label: "17 Boulevard Haussmann 75009 Paris",
  postcode: "75009",
  city: "Paris",
  citycode: "75109",
  lat: 48.872,
  lon: 2.331,
  score: 0.96,
};

describe("banAddressFrom", () => {
  it("extrait l'adresse canonique de la fixture BAN", () => {
    const a = banAddressFrom(banFixture);
    expect(a?.id).toBe("75109_4673_00017");
    expect(a?.label).toBe("17 Boulevard Haussmann 75009 Paris");
    expect(a?.city).toBe("Paris");
    expect(a?.lat).toBeCloseTo(48.872);
    expect(a?.score).toBeGreaterThan(0.9);
  });

  it("renvoie null sur une réponse vide ou nulle", () => {
    expect(banAddressFrom({ features: [] })).toBeNull();
    expect(banAddressFrom(null)).toBeNull();
  });
});

describe("normalizeSirene — clé d'adresse canonique BAN", () => {
  it("utilise l'identifiant BAN comme clé de nœud + coordonnées (score confiant)", () => {
    const r = normalizeSirene(UL, ETAB, BAN_ADDR);
    const address = r.entities.find((e) => e.type === "address");
    expect(address?.id).toBe("ad:ban:75109_4673_00017");
    expect(address?.label).toBe("17 Boulevard Haussmann 75009 Paris");
    expect(address?.attributes?.["Référence BAN"]).toBe("75109_4673_00017");
    expect(address?.attributes?.["Coordonnées"]).toContain("48.872");
    const edge = r.edges.find((e) => e.type === "PARTAGE_ADRESSE");
    expect(edge?.target).toBe("ad:ban:75109_4673_00017");
  });

  it("retombe sur le slug Sirene sans BAN ou si le score est faible", () => {
    const sansBan = normalizeSirene(UL, ETAB);
    expect(sansBan.entities.find((e) => e.type === "address")?.id).toMatch(/^ad:(?!ban:)/);

    const scoreFaible = normalizeSirene(UL, ETAB, { ...BAN_ADDR, score: 0.3 });
    expect(scoreFaible.entities.find((e) => e.type === "address")?.id).toMatch(/^ad:(?!ban:)/);
  });

  it("enrichit le code NAF d'un libellé lisible", () => {
    const r = normalizeSirene(UL, ETAB, BAN_ADDR);
    const company = r.entities.find((e) => e.type === "company");
    expect(company?.attributes?.["Activité (NAF)"]).toBe(
      "7010Z — Activités des sièges sociaux",
    );
  });
});
