import { ibanCountry, isValidIban, normalizeIban } from "@/lib/iban";
import { isValidSiren, normalizeSiren } from "@/lib/siren";
import { parseAmount } from "./parse";

/**
 * Lecture d'un relevé CSV déjà découpé (lignes clé → valeur) en transactions
 * typées. PUR et LOCAL : aucune donnée ne quitte le navigateur, rien n'est
 * complété ni deviné — une colonne absente reste absente (`undefined`) et
 * l'interface le dit.
 *
 * Colonnes reconnues (insensibles à la casse, synonymes ci-dessous) : montant
 * signé OU débit / crédit, date, contrepartie, libellé, IBAN, devise, pays,
 * SIREN de la contrepartie, statut d'origine, référence.
 */

const COLUMNS = {
  amount: ["montant", "amount", "valeur"],
  debit: ["debit", "débit"],
  credit: ["credit", "crédit"],
  date: ["date", "dateop", "date_operation", "date_valeur"],
  counterparty: ["contrepartie", "counterparty", "beneficiaire", "bénéficiaire", "tiers", "nom", "libelle", "libellé", "label"],
  label: ["libelle", "libellé", "label", "description", "motif"],
  iban: ["iban", "compte", "account"],
  currency: ["devise", "currency", "monnaie"],
  country: ["pays", "country", "pays_contrepartie"],
  siren: ["siren", "siren_contrepartie"],
  status: ["statut", "status", "etat", "état"],
  reference: ["reference", "référence", "ref", "transaction_id"],
} as const;

export type ColumnKey = keyof typeof COLUMNS;

/** Dimensions effectivement présentes dans le fichier (au moins une valeur). */
export type DetectedColumns = Record<ColumnKey, boolean>;

export type TransactionRecord = {
  /** Identifiant local stable : index de ligne de données (0-based). */
  id: string;
  /** Ligne du fichier CSV (en-tête = ligne 1). */
  line: number;
  /** Montant signé : négatif = débit (sortie), positif = crédit (entrée). */
  amount: number;
  /** Date telle que lue dans le fichier. */
  dateRaw?: string;
  /** Date normalisée AAAA-MM-JJ si la valeur est interprétable. */
  date?: string;
  counterparty?: string;
  label?: string;
  /** IBAN normalisé (espaces retirés, capitales). */
  iban?: string;
  ibanValid?: boolean;
  /** Pays de l'IBAN (2 lettres) si l'IBAN est valide. */
  ibanCountry?: string;
  /** Code devise (3 lettres) lu dans la colonne devise ou le symbole du montant (€, £). */
  currency?: string;
  /** Pays tel que fourni par la colonne pays du fichier. */
  country?: string;
  /** SIREN de la contrepartie (9 chiffres), s'il est fourni. */
  siren?: string;
  /** Clé de contrôle (Luhn) du SIREN — affichée, sans bloquer le rapprochement. */
  sirenValid?: boolean;
  /** Statut d'origine (colonne du fichier), jamais calculé. */
  sourceStatus?: string;
  reference?: string;
  /** Ligne brute du fichier, pour la traçabilité (panneau « Source »). */
  raw: Record<string, string>;
};

export type IngestResult = {
  transactions: TransactionRecord[];
  /** En-tête du fichier, dans son ordre (export fidèle, colonnes vides comprises). */
  headers: string[];
  columns: DetectedColumns;
  /** Lignes sans montant exploitable (ignorées, comptées). */
  skipped: number;
};

function lowerKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === null) continue;
    const value = String(v).trim();
    if (value !== "") out[k.toLowerCase().trim()] = value;
  }
  return out;
}

function pick(row: Record<string, string>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = row[key];
    if (v !== undefined) return v;
  }
  return undefined;
}

/**
 * Date → AAAA-MM-JJ. Accepte ISO (« 2026-01-15 », horodatage) et l'ordre
 * français jour / mois / année (« 15/01/2026 », « 15-01-2026 », « 15.01.2026 »).
 * Toute autre forme reste non interprétée (jamais devinée).
 */
export function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : fr
      ? [Number(fr[3]), Number(fr[2]), Number(fr[1])]
      : [NaN, NaN, NaN];
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return undefined; // 31/02 → rejeté
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function currencyOf(row: Record<string, string>, amountCell: string | undefined): string | undefined {
  const column = pick(row, COLUMNS.currency);
  if (column) {
    const code = column.toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) return code;
    if (column === "€") return "EUR";
    if (column === "£") return "GBP";
    return column;
  }
  if (amountCell?.includes("€")) return "EUR";
  if (amountCell?.includes("£")) return "GBP";
  return undefined;
}

/** Montant signé : colonne signée, sinon crédit − débit (débit = sortie). */
function signedAmount(row: Record<string, string>): { amount: number; cell?: string } {
  const cell = pick(row, COLUMNS.amount);
  if (cell !== undefined) return { amount: parseAmount(cell), cell };
  const debitCell = pick(row, COLUMNS.debit);
  const creditCell = pick(row, COLUMNS.credit);
  const debit = debitCell !== undefined ? Math.abs(parseAmount(debitCell)) : NaN;
  const credit = creditCell !== undefined ? Math.abs(parseAmount(creditCell)) : NaN;
  if (Number.isFinite(debit) && debit !== 0) return { amount: -debit, cell: debitCell };
  if (Number.isFinite(credit)) return { amount: credit, cell: creditCell };
  if (Number.isFinite(debit)) return { amount: -debit, cell: debitCell };
  return { amount: NaN };
}

export function ingestRows(rows: Record<string, unknown>[], headers?: string[]): IngestResult {
  const columns = Object.fromEntries(
    (Object.keys(COLUMNS) as ColumnKey[]).map((k) => [k, false]),
  ) as DetectedColumns;
  const transactions: TransactionRecord[] = [];
  let skipped = 0;

  rows.forEach((source, index) => {
    if (!source || typeof source !== "object") return;
    const row = lowerKeys(source);
    for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
      if (pick(row, COLUMNS[key]) !== undefined) columns[key] = true;
    }

    const { amount, cell } = signedAmount(row);
    if (!Number.isFinite(amount)) {
      skipped += 1;
      return;
    }

    const ibanCell = pick(row, COLUMNS.iban);
    const iban = ibanCell ? normalizeIban(ibanCell) : undefined;
    const ibanValid = iban ? isValidIban(iban) : undefined;
    const sirenCell = pick(row, COLUMNS.siren);
    const siren = sirenCell ? normalizeSiren(sirenCell) : undefined;
    const countryCell = pick(row, COLUMNS.country);
    const dateRaw = pick(row, COLUMNS.date);

    transactions.push({
      id: String(index),
      line: index + 2,
      amount,
      dateRaw,
      date: normalizeDate(dateRaw),
      counterparty: pick(row, COLUMNS.counterparty),
      label: pick(row, COLUMNS.label),
      iban,
      ibanValid,
      ibanCountry: iban && ibanValid ? (ibanCountry(iban) ?? undefined) : undefined,
      currency: currencyOf(row, cell),
      country: countryCell && /^[a-z]{2}$/i.test(countryCell) ? countryCell.toUpperCase() : countryCell,
      siren: siren && /^\d{9}$/.test(siren) ? siren : undefined,
      sirenValid: siren && /^\d{9}$/.test(siren) ? isValidSiren(siren) : undefined,
      sourceStatus: pick(row, COLUMNS.status),
      reference: pick(row, COLUMNS.reference),
      raw: Object.fromEntries(
        Object.entries(source)
          .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
          .map(([k, v]) => [k, String(v).trim()]),
      ),
    });
  });

  const seen = new Set<string>(headers ?? []);
  for (const t of transactions) for (const k of Object.keys(t.raw)) seen.add(k);
  return { transactions, headers: [...seen], columns, skipped };
}
