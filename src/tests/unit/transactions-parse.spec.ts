import { describe, it, expect } from "vitest";
import { parseAmount } from "@/lib/transactions/parse";

describe("parseAmount — montants CSV FR/US", () => {
  it("gère le format FR (point milliers, virgule décimale)", () => {
    expect(parseAmount("1.234,56")).toBeCloseTo(1234.56);
    expect(parseAmount("12.345.678,90")).toBeCloseTo(12345678.9);
    expect(parseAmount("1 234,56")).toBeCloseTo(1234.56);
    expect(parseAmount("1234,56")).toBeCloseTo(1234.56);
  });

  it("gère le format US (virgule milliers, point décimal)", () => {
    expect(parseAmount("1,234.56")).toBeCloseTo(1234.56);
    expect(parseAmount("1234.56")).toBeCloseTo(1234.56);
    expect(parseAmount("1,000,000.00")).toBeCloseTo(1000000);
  });

  it("gère entiers, signes, nombres et symboles", () => {
    expect(parseAmount("1234")).toBe(1234);
    expect(parseAmount("-820,50")).toBeCloseTo(-820.5);
    expect(parseAmount(4200)).toBe(4200);
    expect(parseAmount("1 500,00 €")).toBeCloseTo(1500);
  });

  it("renvoie NaN sur une cellule non numérique", () => {
    expect(Number.isNaN(parseAmount(""))).toBe(true);
    expect(Number.isNaN(parseAmount("n/a"))).toBe(true);
    expect(Number.isNaN(parseAmount(null))).toBe(true);
  });
});
