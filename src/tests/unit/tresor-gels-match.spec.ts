import { describe, it, expect } from "vitest";
import {
  extractGelsEntries,
  matchGelsEntries,
  type GelsEntry,
} from "@/lib/connectors/tresor-gels-match";

// Données SYNTHÉTIQUES (aucune personne ni société réelle).
const publication = {
  Publications: {
    DatePublication: "2026-10-01",
    PublicationDetail: [
      {
        IdRegistre: 1,
        Nature: "Personne morale",
        Nom: "ACME INTERNATIONAL HOLDING LTD",
        RegistreDetail: [
          { TypeChamp: "ALIAS", Valeur: [{ Alias: "ACME HOLDING" }] },
          { TypeChamp: "ADRESSE", Valeur: [{ Adresse: "1 rue Fictive" }] },
        ],
      },
      {
        IdRegistre: 2,
        Nature: "Personne physique",
        Nom: "DUPONT",
        RegistreDetail: [],
      },
      { IdRegistre: 3, Nature: "Navire", Nom: "OCEAN FICTIF" },
      { IdRegistre: 4, Nom: "" },
    ],
  },
};

describe("extractGelsEntries", () => {
  it("extrait nom, nature, alias et date de publication", () => {
    const res = extractGelsEntries(publication);
    expect(res.status).toBe("ok");
    expect(res.publicationDate).toBe("2026-10-01");
    expect(res.entries).toHaveLength(3); // l'entrée sans nom est ignorée
    expect(res.entries[0]).toEqual({
      nom: "ACME INTERNATIONAL HOLDING LTD",
      nature: "Personne morale",
      aliases: ["ACME HOLDING"],
    });
  });

  it("tolère la casse des clés", () => {
    const res = extractGelsEntries({
      publications: { publicationDetail: [{ nom: "ZETA FICTIVE SA", nature: "Entité" }] },
    });
    expect(res.status).toBe("ok");
    expect(res.entries[0].nom).toBe("ZETA FICTIVE SA");
  });

  it("signale un schéma non reconnu au lieu de conclure à l'absence de résultat", () => {
    for (const unknown of [{ foo: 1 }, [], null, "<html>erreur</html>", { Publications: { PublicationDetail: [] } }]) {
      const res = extractGelsEntries(unknown);
      expect(res.status).toBe("schema_inconnu");
      expect(res.entries).toEqual([]);
    }
  });
});

describe("matchGelsEntries", () => {
  const entries = extractGelsEntries(publication).entries;

  it("égalité exacte via un alias, malgré accents, ponctuation et forme juridique", () => {
    const m = matchGelsEntries(entries, { name: "Acme Holding S.A.S." });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({
      nom: "ACME INTERNATIONAL HOLDING LTD",
      matchType: "exact",
      type: "Personne morale",
      score: 1,
    });
  });

  it("correspondance approximative pour une variante très proche", () => {
    const m = matchGelsEntries(entries, { name: "ACME INTERNATIONAL HOLDINGS" });
    expect(m).toHaveLength(1);
    expect(m[0].matchType).toBe("approximatif");
    expect(m[0].score).toBeGreaterThanOrEqual(0.93);
  });

  it("aucune correspondance pour une dénomination sans rapport", () => {
    expect(matchGelsEntries(entries, { name: "BOULANGERIE DURAND ET FILS" })).toEqual([]);
  });

  it("n'associe jamais une société à une personne physique", () => {
    expect(matchGelsEntries(entries, { name: "DUPONT" })).toEqual([]);
  });

  it("pas d'approximation sur une dénomination trop courte", () => {
    const short: GelsEntry[] = [{ nom: "ABCE", nature: "Personne morale", aliases: [] }];
    expect(matchGelsEntries(short, { name: "ABCD" })).toEqual([]);
    // l'égalité stricte reste détectée
    expect(matchGelsEntries(short, { name: "abce" })).toHaveLength(1);
  });

  it("renvoie [] sans dénomination", () => {
    expect(matchGelsEntries(entries, { name: "  " })).toEqual([]);
    expect(matchGelsEntries(entries, {})).toEqual([]);
  });

  it("borne le bruit à 5 candidats, les exacts d'abord", () => {
    const many: GelsEntry[] = [
      ...Array.from({ length: 8 }, (_, i) => ({
        nom: `GLOBAL TRADING PARTNERS ${i === 0 ? "" : "X".repeat(i)}`.trim(),
        nature: "Personne morale",
        aliases: [],
      })),
    ];
    const m = matchGelsEntries(many, { name: "Global Trading Partners" });
    expect(m.length).toBeLessThanOrEqual(5);
    expect(m[0].matchType).toBe("exact");
  });
});
