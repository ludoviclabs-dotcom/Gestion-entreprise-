"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  analyzeTransactions,
  type Transaction,
  type TransactionReport,
} from "@/lib/risk/transactional";
import { findSharedIbans, isValidIban, normalizeIban } from "@/lib/iban";
import { parseAmount } from "@/lib/transactions/parse";
import BenfordChart from "./BenfordChart";

type Analysis = {
  report: TransactionReport;
  txns: Transaction[];
  sharedIbans: { iban: string; entityIds: string[] }[];
  ibanStats: { withIban: number; valid: number };
};

function pick(row: Record<string, unknown>, keys: string[]): string | undefined {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = v;
  for (const key of keys) {
    const v = lower[key];
    if (v !== undefined && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

export default function TransactionAnalyzer() {
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onFile(file: File) {
    setError(null);
    setFileName(file.name);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const rows = res.data.filter((r) => r && typeof r === "object");
          const txns: Transaction[] = [];
          const ibanEntries: { id: string; iban: string }[] = [];
          let withIban = 0;
          let valid = 0;
          rows.forEach((row, i) => {
            const amount = parseAmount(
              pick(row, ["montant", "amount", "debit", "credit", "valeur"]),
            );
            const date = pick(row, ["date", "dateop", "date_operation", "date_valeur"]);
            const counterparty = pick(row, [
              "contrepartie", "counterparty", "beneficiaire", "libelle", "label", "tiers", "nom",
            ]);
            const iban = pick(row, ["iban", "compte", "account"]);
            if (Number.isFinite(amount)) {
              txns.push({ id: String(i), amount, date, counterparty, label: counterparty });
            }
            if (iban) {
              withIban += 1;
              const norm = normalizeIban(iban);
              if (isValidIban(norm)) {
                valid += 1;
                ibanEntries.push({ id: counterparty ? `cp:${counterparty}` : `tx:${i}`, iban: norm });
              }
            }
          });
          if (txns.length === 0) {
            setError("Aucune transaction exploitable — colonne « montant » introuvable ?");
            setResult(null);
            return;
          }
          setResult({
            report: analyzeTransactions(txns),
            txns,
            sharedIbans: findSharedIbans(ibanEntries),
            ibanStats: { withIban, valid },
          });
        } catch {
          setError("Échec de l'analyse du fichier.");
          setResult(null);
        }
      },
      error: () => {
        setError("Fichier illisible.");
        setResult(null);
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
        <input
          id="tx-file"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <label
          htmlFor="tx-file"
          className="inline-block cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition hover:opacity-80"
        >
          Choisir un fichier CSV
        </label>
        <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
          Colonnes reconnues : <code>montant</code>, <code>date</code>,{" "}
          <code>contrepartie</code>, <code>iban</code>. Analyse{" "}
          <strong>100 % locale</strong> — vos données ne quittent jamais le
          navigateur.
        </p>
        {fileName ? (
          <p className="mt-2 text-xs text-muted-foreground">{fileName}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
          {error}
        </p>
      ) : null}

      {result ? <Results a={result} /> : null}
    </div>
  );
}

function Results({ a }: { a: Analysis }) {
  const { report, txns, sharedIbans, ibanStats } = a;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {report.count} transaction(s) analysée(s). Signaux statistiques à verser
        au faisceau, jamais une conclusion.
      </p>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Loi de Benford
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Distribution du premier chiffre des montants.
        </p>
        <div className="mt-4">
          <BenfordChart result={report.benford} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Doublons ({report.duplicates.length})
        </h3>
        {report.duplicates.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Aucun doublon montant + contrepartie.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {report.duplicates.slice(0, 10).map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3">
                <span className="truncate text-muted-foreground">{d.counterparty}</span>
                <span className="shrink-0 tabular-nums">
                  {d.transactions.length}× {d.amount.toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Montants aberrants ({report.outliers.length})
        </h3>
        {report.outliers.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Aucun montant aberrant (MAD).</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {report.outliers.slice(0, 10).map((o) => (
              <li key={o.index} className="flex items-center justify-between gap-3">
                <span className="truncate text-muted-foreground">
                  {txns[o.index]?.counterparty ?? `Transaction ${o.index + 1}`}
                </span>
                <span className="shrink-0 tabular-nums">
                  {o.value.toLocaleString("fr-FR")}{" "}
                  <span className="text-amber">(score {o.score.toFixed(1)})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ibanStats.withIban > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
            IBAN — validation & réutilisation
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {ibanStats.valid}/{ibanStats.withIban} IBAN structurellement valides (ISO 13616).
            {sharedIbans.length > 0
              ? ` ${sharedIbans.length} IBAN partagé(s) par plusieurs contreparties.`
              : " Aucun IBAN partagé."}
          </p>
          {sharedIbans.length > 0 ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {sharedIbans.slice(0, 10).map((s) => (
                <li key={s.iban} className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs">{s.iban}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {s.entityIds.length} contreparties
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
