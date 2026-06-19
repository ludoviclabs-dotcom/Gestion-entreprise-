import { describe, it, expect } from "vitest";
import {
  normalizeIban,
  ibanCountry,
  isValidIban,
  isValidBic,
  findSharedIbans,
} from "@/lib/iban";

describe("isValidIban — ISO 13616 (clé mod 97)", () => {
  it("accepte des IBAN officiels valides (multi-pays)", () => {
    expect(isValidIban("FR1420041010050500013M02606")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("GB82WEST12345698765432")).toBe(true);
    expect(isValidIban("BE68539007547034")).toBe(true);
  });

  it("ignore espaces et casse", () => {
    expect(isValidIban("fr14 2004 1010 0505 0001 3m02 606")).toBe(true);
  });

  it("rejette une clé de contrôle erronée", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("FR1420041010050500013M02607")).toBe(false);
  });

  it("rejette une longueur pays incorrecte ou un format invalide", () => {
    expect(isValidIban("FR14")).toBe(false); // trop court
    expect(isValidIban("DE8937040044053201300")).toBe(false); // 21 ≠ 22 (DE)
    expect(isValidIban("0014FR41010050500013M02606")).toBe(false); // ne commence pas par 2 lettres
    expect(isValidIban("")).toBe(false);
  });
});

describe("ibanCountry / normalizeIban", () => {
  it("extrait le code pays", () => {
    expect(ibanCountry("FR1420041010050500013M02606")).toBe("FR");
    expect(ibanCountry("de89 3704 0044 0532 0130 00")).toBe("DE");
    expect(ibanCountry("1234")).toBeNull();
  });

  it("normalise (sans espaces/tirets, capitales)", () => {
    expect(normalizeIban("fr14-2004 1010")).toBe("FR1420041010");
  });
});

describe("isValidBic — ISO 9362", () => {
  it("accepte 8 ou 11 caractères bien formés", () => {
    expect(isValidBic("BNPAFRPP")).toBe(true);
    expect(isValidBic("BNPAFRPPXXX")).toBe(true);
    expect(isValidBic("deutdeff500")).toBe(true);
  });

  it("rejette les formats invalides", () => {
    expect(isValidBic("BNPAFR")).toBe(false); // trop court
    expect(isValidBic("1234FRPP")).toBe(false); // chiffres dans le code banque
    expect(isValidBic("BNPAFRPPXX")).toBe(false); // 10 caractères
  });
});

describe("findSharedIbans — signal de réutilisation", () => {
  it("retient les IBAN partagés par ≥ 2 entités, ignore les invalides", () => {
    const shared = findSharedIbans([
      { id: "co:a", iban: "FR1420041010050500013M02606" },
      { id: "co:b", iban: "fr14 2004 1010 0505 0001 3m02 606" }, // même IBAN, formaté
      { id: "co:c", iban: "DE89370400440532013000" }, // unique
      { id: "co:d", iban: "DE00000000000000000000" }, // clé invalide → ignoré
    ]);
    expect(shared).toHaveLength(1);
    expect(shared[0].iban).toBe("FR1420041010050500013M02606");
    expect(shared[0].entityIds.sort()).toEqual(["co:a", "co:b"]);
  });

  it("ne compte pas deux fois la même entité", () => {
    const shared = findSharedIbans([
      { id: "co:a", iban: "BE68539007547034" },
      { id: "co:a", iban: "BE68 5390 0754 7034" },
    ]);
    expect(shared).toHaveLength(0); // une seule entité distincte
  });
});
