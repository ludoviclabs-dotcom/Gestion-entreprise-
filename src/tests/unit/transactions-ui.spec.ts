import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ingestRows } from "@/lib/transactions/ingest";
import { triageTransactions, type SignalKind } from "@/lib/transactions/triage";
import { TransactionsList, TransactionsTable } from "@/components/transactions/TransactionsTable.client";
import TransactionDetail from "@/components/transactions/TransactionDetail.client";
import TransactionFilters, { type FilterAvailability } from "@/components/transactions/TransactionFilters.client";
import BenfordChart from "@/components/transactions/BenfordChart";
import { formatAmount } from "@/components/transactions/format";

/**
 * Rendu de l'espace transactions : hiérarchie scannable, sens du flux et
 * signaux écrits (jamais la couleur seule), motifs, liens explicites,
 * filtres désactivés avec leur motif quand le fichier ne les alimente pas.
 */

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const noop = () => {};

const { items } = triageTransactions(
  ingestRows([
    { montant: "-1200", date: "2026-01-05", contrepartie: "Loyer SCI", devise: "EUR", siren: "552032534" },
    { montant: "-1200", date: "2026-02-05", contrepartie: "Loyer SCI", devise: "EUR" },
    { montant: "450", date: "2026-02-07", contrepartie: "Client A", reference: "R-1" },
  ]).transactions,
);

describe("formatAmount", () => {
  it("signe explicite et devise seulement si connue", () => {
    expect(formatAmount(-1200, "EUR")).toMatch(/^−1\s200,00 EUR$/);
    expect(formatAmount(450)).toMatch(/^\+450,00$/);
  });
});

describe("TransactionsTable / TransactionsList", () => {
  const props = { items, statusOf: () => "a_trier" as const, selectedId: items[0].id, onSelect: noop };

  it("tableau : montant signé + sens écrit, signaux et vigilance en toutes lettres, tri annoncé", () => {
    const out = html(h(TransactionsTable, { ...props, sort: { key: "date", dir: "desc" }, onSort: noop }));
    expect(out).toMatch(/−1\s200,00 EUR/);
    expect(out).toContain("Débit");
    expect(out).toContain("Crédit");
    expect(out).toContain("Doublon");
    expect(out).toContain("Vigilance");
    expect(out).toContain("À trier");
    expect(out).toContain('aria-sort="descending"');
    expect(out).toContain('aria-selected="true"');
    expect(out).toMatch(/aria-label="Ouvrir la transaction ligne 2 : Loyer SCI/);
  });

  it("liste mobile : mêmes informations, sans table", () => {
    const out = html(h(TransactionsList, props));
    expect(out).not.toContain("<table");
    expect(out).toContain("Loyer SCI");
    expect(out).toContain("Débit");
    expect(out).toContain("Doublon");
  });
});

describe("TransactionDetail", () => {
  const base = {
    status: "a_trier" as const,
    onStatusChange: noop,
    fileName: "releve.csv",
    lineOf: (id: string) => items.find((t) => t.id === id)?.line,
    onSelect: noop,
    onFilterSignal: (k: SignalKind) => void k,
  };

  it("signal : motif écrit et lien vers la transaction liée ; dossier rapproché par SIREN ; source", () => {
    const out = html(
      h(TransactionDetail, {
        ...base,
        t: items[0],
        linkedCase: { id: "c1", title: "Holding X", rootSiren: "552032534" },
      }),
    );
    expect(out).toContain("Motif : ");
    expect(out).toMatch(/légitime/);
    expect(out).toContain("ligne 3");
    expect(out).toContain('href="/cases/c1/graphe"');
    expect(out).toContain('href="/cases/c1/risques"');
    expect(out).toContain("releve.csv · ligne 2");
    expect(out).toContain("contrepartie");
  });

  it("sans SIREN : le rapprochement impossible est dit ; données absentes signalées, jamais inventées", () => {
    const out = html(h(TransactionDetail, { ...base, t: items[2] }));
    expect(out).toContain("Pas de SIREN pour cette contrepartie");
    expect(out).toContain("Non fourni par le fichier");
    expect(out).toContain("devise non précisée");
    expect(out).toContain("Aucun détecteur");
  });
});

describe("TransactionFilters", () => {
  const availability: FilterAvailability = {
    dates: true,
    counterparty: true,
    currencies: [],
    hasUnknownCurrency: true,
    countries: [],
    countryFromIban: true,
    siren: false,
    signalCounts: { duplicate: 2, outlier: 0, shared_iban: 0, invalid_iban: 0, aucun: 1 },
  };

  it("filtres sans donnée : désactivés, motif écrit ; signal sans occurrence désactivé", () => {
    const out = html(h(TransactionFilters, { filters: {}, onChange: noop, onPatch: noop, availability, shown: 3, total: 3 }));
    expect(out).toContain("Colonne SIREN absente");
    expect(out).toContain("Aucune devise dans le fichier");
    expect(out).toContain("Ni colonne pays ni IBAN valide");
    expect(out).toMatch(/<option value="outlier" disabled="">Montant atypique \(0\)/);
  });

  it("filtres actifs : puces nommées et retirables", () => {
    const out = html(
      h(TransactionFilters, { filters: { signal: "duplicate", min: 100 }, onChange: noop, onPatch: noop, availability, shown: 2, total: 3 }),
    );
    expect(out).toContain('aria-label="Retirer le filtre Signal : Doublon"');
    expect(out).toContain("Montant ≥ 100");
    expect(out).toContain("Réinitialiser");
  });
});

describe("BenfordChart", () => {
  it("effectif insuffisant : pas de conclusion ; table accessible des fréquences", () => {
    const out = html(h(BenfordChart, { result: triageTransactions(ingestRows([{ montant: "12" }]).transactions).report.benford }));
    expect(out).toContain("Effectif insuffisant");
    expect(out).toContain("<table");
  });
});
