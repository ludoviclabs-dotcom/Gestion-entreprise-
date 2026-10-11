import { describe, expect, it } from "vitest";
import { ingestRows, normalizeDate } from "@/lib/transactions/ingest";
import {
  filtersFromParams,
  filtersToParams,
  matchesFilters,
  riskOf,
  sortTransactions,
  summarize,
  triageTransactions,
  type TxFilters,
} from "@/lib/transactions/triage";
import { robustDispersion, findAmountOutliers } from "@/lib/risk/transactional";

const VALID_IBAN = "FR7630006000011234567890189";
const INVALID_IBAN = "FR7630006000011234567890188";

describe("ingestRows — lecture fidèle, rien d'inventé", () => {
  it("détecte les colonnes présentes et laisse absentes les autres", () => {
    const { transactions, columns, skipped } = ingestRows([
      { Montant: "-1 200,50", Date: "15/01/2026", Contrepartie: "ACME SAS" },
      { Montant: "n/a", Date: "16/01/2026", Contrepartie: "X" },
    ]);
    expect(skipped).toBe(1);
    expect(transactions).toHaveLength(1);
    const [t] = transactions;
    expect(t).toMatchObject({ line: 2, amount: -1200.5, date: "2026-01-15", counterparty: "ACME SAS" });
    expect(t.currency).toBeUndefined();
    expect(t.country).toBeUndefined();
    expect(t.siren).toBeUndefined();
    expect(columns).toMatchObject({ amount: true, date: true, counterparty: true, currency: false, country: false, siren: false });
  });

  it("débit / crédit séparés : le débit devient un montant négatif", () => {
    const { transactions } = ingestRows([
      { debit: "250,00", credit: "" },
      { debit: "", credit: "1.000,00" },
    ]);
    expect(transactions.map((t) => t.amount)).toEqual([-250, 1000]);
  });

  it("devise : colonne, sinon symbole du montant — jamais supposée", () => {
    const { transactions } = ingestRows([
      { montant: "10", devise: "usd" },
      { montant: "1 500,00 €" },
      { montant: "12" },
    ]);
    expect(transactions.map((t) => t.currency)).toEqual(["USD", "EUR", undefined]);
  });

  it("IBAN normalisé + validité + pays ; SIREN à 9 chiffres gardé, clé de contrôle signalée", () => {
    const { transactions } = ingestRows([
      { montant: "1", iban: "fr76 3000 6000 0112 3456 7890 189", siren: "552 032 534" },
      { montant: "2", iban: INVALID_IBAN, siren: "123456789" },
    ]);
    expect(transactions[0]).toMatchObject({ iban: VALID_IBAN, ibanValid: true, ibanCountry: "FR", siren: "552032534", sirenValid: true });
    expect(transactions[1]).toMatchObject({ ibanValid: false, ibanCountry: undefined, siren: "123456789", sirenValid: false });
    expect(ingestRows([{ montant: "1", siren: "12345" }]).transactions[0].siren).toBeUndefined();
  });

  it("conserve la ligne brute pour la traçabilité", () => {
    const { transactions } = ingestRows([{ Montant: "5", Référence: "TX-9", Vide: "" }]);
    expect(transactions[0].raw).toEqual({ Montant: "5", Référence: "TX-9" });
    expect(transactions[0].reference).toBe("TX-9");
  });

  it("dates : ISO et jour/mois/année ; le reste n'est pas deviné", () => {
    expect(normalizeDate("2026-03-09")).toBe("2026-03-09");
    expect(normalizeDate("2026-03-09T10:00:00Z")).toBe("2026-03-09");
    expect(normalizeDate("09/03/2026")).toBe("2026-03-09");
    expect(normalizeDate("9.3.2026")).toBe("2026-03-09");
    expect(normalizeDate("31/02/2026")).toBeUndefined();
    expect(normalizeDate("mars 2026")).toBeUndefined();
  });
});

function sample() {
  return ingestRows([
    { montant: "-1200", date: "2026-01-05", contrepartie: "Loyer SCI", iban: VALID_IBAN, devise: "EUR" },
    { montant: "-1200", date: "2026-02-05", contrepartie: "loyer sci", devise: "EUR" },
    { montant: "-95", date: "2026-01-10", contrepartie: "Fournisseur A", iban: VALID_IBAN, devise: "EUR" },
    { montant: "-110", date: "2026-01-12", contrepartie: "Fournisseur B", devise: "EUR" },
    { montant: "-102", date: "2026-01-14", contrepartie: "Fournisseur C", devise: "EUR" },
    { montant: "-98", date: "2026-01-16", contrepartie: "Fournisseur D", devise: "EUR" },
    { montant: "-48000", date: "2026-01-20", contrepartie: "Prestataire Z", iban: INVALID_IBAN, devise: "EUR" },
    { montant: "300", date: "illisible", contrepartie: "Client", devise: "USD", siren: "552032534" },
  ]).transactions;
}

describe("triageTransactions — signaux avec motif écrit", () => {
  const { items, dispersion } = triageTransactions(sample());
  const byLine = (line: number) => items.find((t) => t.line === line)!;

  it("doublon : motif cite le montant et les lignes liées, et rappelle la légitimité possible", () => {
    const dup = byLine(2).signals.find((s) => s.kind === "duplicate")!;
    expect(dup.motif).toMatch(/1\s200,00/);
    expect(dup.motif).toContain("ligne 3");
    expect(dup.motif).toMatch(/légitime/);
    expect(dup.related).toEqual([byLine(3).id]);
  });

  it("montant atypique : motif cite la médiane et le seuil", () => {
    const out = byLine(8).signals.find((s) => s.kind === "outlier")!;
    expect(dispersion).not.toBeNull();
    expect(out.motif).toMatch(/médiane/);
    expect(out.motif).toMatch(/seuil 3,5/);
  });

  it("IBAN partagé entre contreparties distinctes ; IBAN invalide signalé", () => {
    const shared = byLine(2).signals.find((s) => s.kind === "shared_iban")!;
    expect(shared.motif).toContain("Fournisseur A");
    expect(byLine(8).signals.map((s) => s.kind)).toContain("invalid_iban");
  });

  it("vigilance : 1 signal → vigilance, 2 natures → renforcée, 0 → aucun", () => {
    expect(byLine(8).risk).toBe("renforcee"); // atypique + IBAN invalide
    expect(byLine(5).risk).toBe("aucun");
    expect(riskOf([])).toBe("aucun");
  });
});

describe("filtres et tri", () => {
  const { items } = triageTransactions(sample());
  const ctx = { status: "a_trier" as const, linked: false };
  const keep = (f: TxFilters) => items.filter((t) => matchesFilters(t, f, ctx)).map((t) => t.line);

  it("période (bornes incluses) : les dates illisibles sont exclues quand une borne est posée", () => {
    expect(keep({ from: "2026-01-10", to: "2026-01-16" })).toEqual([4, 5, 6, 7]);
  });

  it("montant sur la valeur absolue, devise, contrepartie sans accents ni casse", () => {
    expect(keep({ min: 1000 })).toEqual([2, 3, 8]);
    expect(keep({ currency: "USD" })).toEqual([9]);
    expect(keep({ q: "FOURNISSEUR a" })).toEqual([4]);
  });

  it("signal, vigilance, statut et dossier lié", () => {
    expect(keep({ signal: "duplicate" })).toEqual([2, 3]);
    expect(keep({ risk: "signalee" }).length).toBeGreaterThan(0);
    expect(keep({ status: "traitee" })).toEqual([]);
    expect(items.filter((t) => matchesFilters(t, { linked: "oui" }, { status: "a_trier", linked: t.line === 9 })).map((t) => t.line)).toEqual([9]);
  });

  it("tri : date (illisibles en fin), montant absolu décroissant", () => {
    expect(sortTransactions(items, { key: "date", dir: "asc" }).map((t) => t.line).at(-1)).toBe(9);
    expect(sortTransactions(items, { key: "montant", dir: "desc" })[0].line).toBe(8);
  });

  it("aller-retour URL : filtres et tri conservés, valeurs invalides ignorées", () => {
    const f: TxFilters = { from: "2026-01-01", risk: "signalee", min: 100, q: "sci", signal: "duplicate", linked: "oui" };
    const params = filtersToParams(f, { key: "montant", dir: "desc" });
    expect(params.get("tri")).toBe("-montant");
    expect(filtersFromParams(params)).toEqual({ filters: f, sort: { key: "montant", dir: "desc" } });
    const bad = filtersFromParams(new URLSearchParams("du=hier&risque=max&min=-5&signal=x"));
    expect(bad.filters).toEqual({});
  });
});

describe("summarize — en-tête", () => {
  it("période sur les dates lisibles, volumes par devise jamais additionnés", () => {
    const s = summarize(triageTransactions(sample()).items);
    expect(s.count).toBe(8);
    expect(s.period).toEqual({ from: "2026-01-05", to: "2026-02-05" });
    expect(s.undated).toBe(1);
    const eur = s.volumes.find((v) => v.currency === "EUR")!;
    const usd = s.volumes.find((v) => v.currency === "USD")!;
    expect(eur.debit).toBe(1200 + 1200 + 95 + 110 + 102 + 98 + 48000);
    expect(usd).toMatchObject({ credit: 300, debit: 0, count: 1 });
  });
});

describe("robustDispersion — même calcul que le détecteur", () => {
  it("médiane et MAD ; null sous 4 valeurs ; findAmountOutliers inchangé", () => {
    expect(robustDispersion([1, 2, 3])).toBeNull();
    expect(robustDispersion([10, 10, 12, 14, 1000])).toEqual({ median: 12, mad: 2 });
    expect(findAmountOutliers([10, 10, 12, 14, 1000]).map((o) => o.index)).toEqual([4]);
  });
});
