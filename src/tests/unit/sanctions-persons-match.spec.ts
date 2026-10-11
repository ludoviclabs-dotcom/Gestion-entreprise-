import { describe, it, expect } from "vitest";
import {
  MAX_CORROBORATING_YEARS,
  checkBirth,
  matchPersonEntries,
  type PersonEntry,
} from "@/lib/connectors/sanctions-persons-match";
import { personKeys, personTokens } from "@/lib/connectors/sanctions-lists";
import { buildPersonQueries, collectBirthYears, personNameKey } from "@/lib/ingestion/person-birth-years";

const entry = (nom: string, birthYears: number[] = [], aliases: string[] = []): PersonEntry => ({ nom, aliases, birthYears });

describe("personTokens / personKeys", () => {
  it("sans accents ni ponctuation, mots de deux caractères conservés", () => {
    expect(personTokens("PEDINI (BACONNET) Claire-Émilie")).toEqual(
      expect.arrayContaining(["pedini", "baconnet", "claire", "emilie"]),
    );
    expect(personTokens("Li Wei")).toEqual(["li", "wei"]);
  });
  it("clés : préfixes de 5 caractères, formes juridiques non retirées", () => {
    expect(personKeys(["Mohammed ABU TEIR"])).toEqual(["moham", "abu", "teir"]);
    expect(personKeys(["Sa Majesty"])).toEqual(["sa", "majes"]);
  });
});

describe("checkBirth", () => {
  it("concordante, inconnue, voisine, écartée", () => {
    expect(checkBirth([1971], [1971])).toBe("corroborated");
    expect(checkBirth([], [1971])).toBe("unknown");
    expect(checkBirth([1971], [])).toBe("unknown");
    expect(checkBirth([1971], [1972])).toBe("near");
    expect(checkBirth([1971], [1980])).toBe("excluded");
  });
  it("une plage d'années trop large ne corrobore rien", () => {
    const wide = Array.from({ length: MAX_CORROBORATING_YEARS + 1 }, (_, i) => 1945 + i);
    expect(checkBirth([1946], wide)).toBe("unknown");
    expect(checkBirth([1946], wide.slice(0, MAX_CORROBORATING_YEARS))).toBe("corroborated");
  });
});

describe("matchPersonEntries", () => {
  const q = (name: string, birthYears: number[] = []) => ({ name, birthYears });

  it("nom identique (ordre et casse indifférents) + année concordante → corroborée", () => {
    const { matches, excluded } = matchPersonEntries([entry("Dzmitry LUKASHENKA", [1980])], q("LUKASHENKA Dzmitry", [1980]));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ name: "exact", birth: "corroborated" });
    expect(excluded).toBe(0);
  });

  it("nom identique sans année connue : « à vérifier », jamais corroborée", () => {
    const { matches } = matchPersonEntries([entry("Jean DUPONT", [1960])], q("Jean Dupont"));
    expect(matches[0]).toMatchObject({ name: "exact", birth: "unknown" });
    const noYearListed = matchPersonEntries([entry("Jean DUPONT", [])], q("Jean Dupont", [1960]));
    expect(noYearListed.matches[0].birth).toBe("unknown");
  });

  it("même nom, année différente : homonyme écarté et compté", () => {
    const { matches, excluded } = matchPersonEntries([entry("Jean DUPONT", [1960])], q("Jean Dupont", [1985]));
    expect(matches).toHaveLength(0);
    expect(excluded).toBe(1);
  });

  it("année voisine (± 1 an) : à vérifier, non écartée", () => {
    const { matches } = matchPersonEntries([entry("Jean DUPONT", [1960])], q("Jean Dupont", [1961]));
    expect(matches[0].birth).toBe("near");
  });

  it("noms inclus : prénoms supplémentaires côté dirigeant", () => {
    const { matches } = matchPersonEntries([entry("Jean DUPONT", [1960])], q("Jean Pierre Marie Dupont", [1960]));
    expect(matches[0]).toMatchObject({ name: "inclus", birth: "corroborated" });
  });

  it("alias : le nom réellement rapproché est rapporté", () => {
    const { matches } = matchPersonEntries(
      [entry("Dzmitry LUKASHENKA", [1980], ["Dmitri LUKASHENKO"])],
      q("Dmitri Lukashenko", [1980]),
    );
    expect(matches[0]).toMatchObject({ matchedName: "Dmitri LUKASHENKO", name: "exact" });
  });

  it("jamais de rapprochement approximatif ni d'un seul mot", () => {
    expect(matchPersonEntries([entry("Mohammed ABU TEIR", [1951])], q("Muhammad Abu Tair", [1951])).matches).toHaveLength(0);
    expect(matchPersonEntries([entry("Mohammed ABU TEIR", [1951])], q("Mohammed", [1951])).matches).toHaveLength(0);
    expect(matchPersonEntries([entry("Mohammed", [1951])], q("Mohammed Abu", [1951])).matches).toHaveLength(0);
  });

  it("classe les corroborées d'abord", () => {
    const { matches } = matchPersonEntries(
      [entry("Jean DUPONT", []), entry("Jean DUPONT", [1960])],
      q("Jean Dupont", [1960]),
    );
    expect(matches.map((m) => m.birth)).toEqual(["corroborated", "unknown"]);
  });
});

describe("collectBirthYears / buildPersonQueries", () => {
  it("lit Recherche d'entreprises, Pappers et Companies House ; ignore les personnes morales", () => {
    const years = collectBirthYears({
      recherche: {
        dirigeants: [
          { type: "personne physique", nom: "DUPONT", prenoms: "Alice", anneeNaissance: 1971 },
          { type: "personne morale", nom: null, prenoms: null, denomination: "ACME", anneeNaissance: 1990 },
        ],
      },
      pappers: {
        dirigeants: [{ nom_complet: "Bob Martin", date_de_naissance_formate: "15/03/1969" }],
        beneficiaires_effectifs: [{ prenom: "Carla", nom: "Rossi", date_de_naissance_formate: "1980-07" }],
      },
      companiesHouse: [{ officers: [{ name: "SMITH, John William", corporate: false, birthYear: 1955 }], pscs: [] }],
    });
    expect(years.get(personNameKey("Alice Dupont"))).toEqual([1971]);
    expect(years.get(personNameKey("Martin Bob"))).toEqual([1969]);
    expect(years.get(personNameKey("Carla Rossi"))).toEqual([1980]);
    expect(years.get(personNameKey("John William Smith"))).toEqual([1955]);
    // Titres de civilité de Companies House : écartés, comme dans le graphe.
    const titled = collectBirthYears({
      companiesHouse: [{ officers: [{ name: "BRANCH, Sonya Judith Clara, Ms.", corporate: false, birthYear: 1962 }], pscs: [] }],
    });
    expect(titled.get(personNameKey("Sonya Judith Clara Branch"))).toEqual([1962]);
    expect(years.has(personNameKey("ACME"))).toBe(false);
  });

  it("ne retient jamais une année implausible", () => {
    const years = collectBirthYears({ recherche: { dirigeants: [{ type: "personne physique", nom: "X", prenoms: "Y Z", anneeNaissance: 1650 }] } });
    expect(years.size).toBe(0);
  });

  it("construit les requêtes sur les personnes seulement, avec leurs années", () => {
    const years = new Map([[personNameKey("Alice Dupont"), [1971]]]);
    const queries = buildPersonQueries(
      [
        { id: "pe:alice-dupont", type: "person", label: "Alice Dupont", evidenceLevel: "declared" },
        { id: "co:1", type: "company", label: "ACME", evidenceLevel: "declared" },
        { id: "pe:alice-dupont", type: "person", label: "Alice Dupont", evidenceLevel: "declared" },
        { id: "pe:bob-martin", type: "person", label: "Bob Martin", evidenceLevel: "declared" },
      ],
      years,
    );
    expect(queries).toEqual([
      { key: "pe:alice-dupont", name: "Alice Dupont", birthYears: [1971] },
      { key: "pe:bob-martin", name: "Bob Martin", birthYears: [] },
    ]);
  });
});
