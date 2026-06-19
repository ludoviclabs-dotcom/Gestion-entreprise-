import { describe, expect, it } from "vitest";
import { normalizeName, stripLegalForms } from "@/lib/match/normalize";
import {
  jaroWinkler,
  tokenSetRatio,
  denominationSimilarity,
} from "@/lib/match/similarity";
import { phoneticKey } from "@/lib/match/phonetic";

describe("normalize", () => {
  it("retire accents, ponctuation des sigles et compacte les espaces", () => {
    expect(normalizeName("L'Oréal")).toBe("loreal");
    expect(normalizeName("DUPONT  S.A.R.L.")).toBe("dupont sarl");
    expect(normalizeName("Jean-Marie  MARTIN")).toBe("jean marie martin");
  });
  it("retire les formes juridiques mais conserve les qualificatifs distinctifs", () => {
    expect(stripLegalForms("DUPONT SARL")).toBe("dupont");
    expect(stripLegalForms("Dupont S.A.R.L.")).toBe("dupont");
    // « holding » est un qualificatif distinctif, PAS une forme juridique.
    expect(stripLegalForms("Martin Holding SAS")).toBe("martin holding");
    expect(stripLegalForms("Spa Resort")).toBe("spa resort");
    expect(stripLegalForms("SARL")).toBe("sarl");
  });

  it("translittère les lettres latines non décomposables (ß, ø, ł...)", () => {
    expect(normalizeName("Łódź")).toBe("lodz");
    expect(normalizeName("Straße")).toBe("strasse");
    expect(normalizeName("Øystein")).toBe("oystein");
  });
});

describe("similarity", () => {
  it("jaroWinkler : identiques = 1, proches élevés, distants bas", () => {
    expect(jaroWinkler("martin", "martin")).toBe(1);
    expect(jaroWinkler("martin", "martyn")).toBeGreaterThan(0.85);
    expect(jaroWinkler("martin", "dupont")).toBeLessThan(0.6);
  });
  it("tokenSetRatio : insensible à l'ordre des mots", () => {
    expect(tokenSetRatio("jean martin", "martin jean")).toBe(1);
  });
  it("denominationSimilarity : ignore les formes juridiques", () => {
    expect(denominationSimilarity("DUPONT SARL", "Dupont S.A.R.L.")).toBe(1);
    expect(denominationSimilarity("Alpha", "Beta")).toBeLessThan(0.6);
  });
});

describe("phonetic", () => {
  it("clé stable pour les variantes accentuées", () => {
    expect(phoneticKey("Martín")).toBe(phoneticKey("Martin"));
  });
  it("le nom de famille partage la clé malgré l'initiale du prénom", () => {
    const surname = phoneticKey("martin");
    expect(phoneticKey("jean martin").endsWith(surname)).toBe(true);
    expect(phoneticKey("j martin").endsWith(surname)).toBe(true);
  });
});
