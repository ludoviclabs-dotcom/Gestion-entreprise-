import { describe, it, expect } from "vitest";
import {
  isValidSiren,
  isValidSiret,
  isValidLuhn,
  normalizeSiren,
} from "@/lib/siren";

describe("siren", () => {
  it("valide un SIREN correct (Danone)", () => {
    expect(isValidSiren("552032534")).toBe(true);
  });
  it("accepte les espaces de formatage", () => {
    expect(isValidSiren("552 032 534")).toBe(true);
  });
  it("rejette une clé de contrôle invalide", () => {
    expect(isValidSiren("552032535")).toBe(false);
  });
  it("rejette une mauvaise longueur", () => {
    expect(isValidSiren("12345")).toBe(false);
  });
  it("valide un SIRET (14 chiffres, Luhn)", () => {
    expect(isValidSiret("55203253400042")).toBe(true);
  });
  it("calcule Luhn brut", () => {
    expect(isValidLuhn("18")).toBe(true);
    expect(isValidLuhn("17")).toBe(false);
  });
  it("normalise un identifiant", () => {
    expect(normalizeSiren("552 032 534")).toBe("552032534");
  });
});
