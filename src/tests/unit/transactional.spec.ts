import { describe, it, expect } from "vitest";
import {
  firstDigit,
  benfordAnalysis,
  BENFORD_EXPECTED,
  findDuplicateTransactions,
  findAmountOutliers,
  analyzeTransactions,
  type Transaction,
} from "@/lib/risk/transactional";

describe("firstDigit", () => {
  it("extrait le premier chiffre significatif", () => {
    expect(firstDigit(123)).toBe(1);
    expect(firstDigit(9999)).toBe(9);
    expect(firstDigit(0.0456)).toBe(4);
    expect(firstDigit(-820)).toBe(8);
  });
  it("renvoie null pour 0 / non fini", () => {
    expect(firstDigit(0)).toBeNull();
    expect(firstDigit(Number.NaN)).toBeNull();
    expect(firstDigit(Infinity)).toBeNull();
  });
});

describe("benfordAnalysis", () => {
  it("ne dévie pas sur une population conforme à Benford", () => {
    const set: number[] = [];
    BENFORD_EXPECTED.forEach((p, i) => {
      const digit = i + 1;
      const k = Math.round(p * 1000);
      // digit*1000 + j garde le premier chiffre = digit (j < 1000).
      for (let j = 0; j < k; j += 1) set.push(digit * 1000 + j);
    });
    const r = benfordAnalysis(set);
    expect(r.count).toBeGreaterThan(900);
    expect(r.chiSquare).toBeLessThan(15.51);
    expect(r.deviates).toBe(false);
  });

  it("dévie sur une population artificielle (premier chiffre fixé)", () => {
    const set = Array.from({ length: 60 }, (_, j) => 9000 + j); // tous premier chiffre 9
    const r = benfordAnalysis(set);
    expect(r.count).toBe(60);
    expect(r.chiSquare).toBeGreaterThan(15.51);
    expect(r.deviates).toBe(true);
  });

  it("ne conclut pas sur un effectif insuffisant (< 50)", () => {
    const r = benfordAnalysis([900, 910, 920, 930]); // skewed mais trop petit
    expect(r.deviates).toBe(false);
  });
});

describe("findDuplicateTransactions", () => {
  it("regroupe montant + contrepartie identiques (insensible à la casse)", () => {
    const txns: Transaction[] = [
      { id: "1", amount: 1500, counterparty: "ACME" },
      { id: "2", amount: 1500, counterparty: "acme" },
      { id: "3", amount: 1500, counterparty: "ACME" },
      { id: "4", amount: 200, counterparty: "OTHER" },
    ];
    const dups = findDuplicateTransactions(txns);
    expect(dups).toHaveLength(1);
    expect(dups[0].amount).toBe(1500);
    expect(dups[0].transactions).toHaveLength(3);
  });

  it("ignore les transactions sans contrepartie", () => {
    const dups = findDuplicateTransactions([
      { id: "1", amount: 100 },
      { id: "2", amount: 100 },
    ]);
    expect(dups).toHaveLength(0);
  });
});

describe("findAmountOutliers (MAD)", () => {
  it("repère un montant extrême, pas le bruit normal", () => {
    const amounts = [100, 102, 98, 101, 99, 103, 97, 100, 100000];
    const out = findAmountOutliers(amounts);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(100000);
    expect(out[0].score).toBeGreaterThan(3.5);
  });
  it("ne renvoie rien sur une population homogène ou trop petite", () => {
    expect(findAmountOutliers([5, 5, 5, 5])).toHaveLength(0);
    expect(findAmountOutliers([1, 2])).toHaveLength(0);
  });
});

describe("analyzeTransactions", () => {
  it("agrège les trois détecteurs", () => {
    const txns: Transaction[] = [
      { id: "1", amount: 1500, counterparty: "ACME" },
      { id: "2", amount: 1500, counterparty: "ACME" },
      { id: "3", amount: 50000, counterparty: "X" },
    ];
    const report = analyzeTransactions(txns);
    expect(report.count).toBe(3);
    expect(report.duplicates).toHaveLength(1);
    expect(report.benford.count).toBeGreaterThan(0);
    expect(Array.isArray(report.outliers)).toBe(true);
  });
});
