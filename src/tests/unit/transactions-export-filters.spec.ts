// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import Papa from "papaparse";
import { ingestRows } from "@/lib/transactions/ingest";
import { triageTransactions } from "@/lib/transactions/triage";
import { buildTriageCsv, FORMULA_TRIGGER } from "@/lib/transactions/export";
import TransactionFilters, { type FilterAvailability } from "@/components/transactions/TransactionFilters.client";

describe("buildTriageCsv — export de la vue", () => {
  const headers = ["date", "contrepartie", "montant", "iban"];
  const { transactions } = ingestRows(
    [
      { date: "2026-01-05", contrepartie: "Loyer SCI", montant: "-1200", iban: "" },
      { date: "2026-01-10", contrepartie: "=HYPERLINK(\"http://x\")", montant: "-95", iban: "FR7630006000011234567890189" },
    ],
    headers,
  );
  const { items } = triageTransactions(transactions);
  const csv = buildTriageCsv(items, () => "a_trier", headers);
  const parsed = Papa.parse<string[]>(csv.trim()).data;

  it("garde toutes les colonnes d'origine, même vides sur la première ligne", () => {
    expect(parsed[0]).toEqual(["ligne", ...headers, "signaux", "motifs", "vigilance", "statut_triage"]);
    expect(parsed[2][4]).toBe("FR7630006000011234567890189");
  });

  it("neutralise une formule venue du fichier, sans transformer un montant négatif en texte", () => {
    expect(parsed[2][2]).toBe("'=HYPERLINK(\"http://x\")");
    expect(parsed[1][3]).toBe("-1200");
  });

  it("motif de déclenchement : formules et variantes pleine chasse, pas les nombres signés", () => {
    for (const v of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "＝1"]) expect(FORMULA_TRIGGER.test(v)).toBe(true);
    for (const v of ["-1200", "+450,00", "-1 200,50", "Loyer"]) expect(FORMULA_TRIGGER.test(v)).toBe(false);
  });

  it("l'en-tête du fichier est conservé par l'import (ordre et colonnes vides)", () => {
    expect(ingestRows([{ a: "", montant: "1" }], ["a", "montant"]).headers).toEqual(["a", "montant"]);
  });
});

describe("TransactionFilters — saisies rapides cumulées", () => {
  let root: Root | null = null;
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  const availability: FilterAvailability = {
    dates: true,
    counterparty: true,
    currencies: ["EUR"],
    hasUnknownCurrency: false,
    countries: [],
    countryFromIban: true,
    siren: false,
    signalCounts: { duplicate: 0, outlier: 0, shared_iban: 0, invalid_iban: 0, aucun: 1 },
  };

  it("deux champs saisis dans la même fenêtre : deux mises à jour PARTIELLES, aucune n'écrase l'autre", () => {
    vi.useFakeTimers();
    const onPatch = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root?.render(h(TransactionFilters, { filters: {}, onChange: vi.fn(), onPatch, availability, shown: 1, total: 1 }));
    });
    const type = (el: HTMLInputElement, value: string) =>
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    type(host.querySelector<HTMLInputElement>('input[type="search"]')!, "sci");
    type(host.querySelector<HTMLInputElement>('input[aria-label="Montant minimum"]')!, "100");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const patches = onPatch.mock.calls.map(([p]) => p);
    expect(patches).toContainEqual({ q: "sci" });
    expect(patches).toContainEqual({ min: 100 });
    // Chaque mise à jour ne porte que son champ : le parent les applique au dernier état.
    for (const p of patches) expect(Object.keys(p)).toHaveLength(1);
  });
});
