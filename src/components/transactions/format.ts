import { formatDateFr } from "@/lib/format-date";
import type { TransactionRecord } from "@/lib/transactions/ingest";
import type { SignalKind } from "@/lib/transactions/triage";
import type { Tone } from "@/lib/design/tone";

/**
 * Montant lisible SANS dépendre de la couleur : signe explicite (« − » pour un
 * débit, « + » pour un crédit), deux décimales, code devise s'il est connu —
 * jamais une devise supposée.
 */
export function formatAmount(amount: number, currency?: string): string {
  const abs = Math.abs(amount).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "−" : amount > 0 ? "+" : "";
  return `${sign}${abs}${currency ? ` ${currency}` : ""}`;
}

/** Sens du flux, écrit en toutes lettres. */
export function directionLabel(amount: number): "Débit" | "Crédit" | "Nul" {
  return amount < 0 ? "Débit" : amount > 0 ? "Crédit" : "Nul";
}

/** Date normalisée (JJ/MM/AAAA), sinon la valeur brute du fichier, sinon « — ». */
export function formatTxDate(t: Pick<TransactionRecord, "date" | "dateRaw">): string {
  if (t.date) return formatDateFr(t.date);
  return t.dateRaw ?? "—";
}

/** Teinte d'appui d'un signal (le libellé est toujours écrit). */
export const SIGNAL_TONE: Record<SignalKind, Tone> = {
  duplicate: "vigilance",
  outlier: "vigilance",
  shared_iban: "vigilance",
  invalid_iban: "info",
};
