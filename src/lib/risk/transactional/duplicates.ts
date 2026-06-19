import type { Transaction } from "./types";

/**
 * Doublons transactionnels : transactions partageant le MÊME montant et la
 * MÊME contrepartie (≥ 2 occurrences). Signal de fractionnement / réémission ;
 * à corroborer (un loyer mensuel identique est légitime).
 */
export type DuplicateGroup = {
  /** Clé « montant|contrepartie ». */
  key: string;
  amount: number;
  counterparty: string;
  transactions: Transaction[];
};

export function findDuplicateTransactions(txns: Transaction[]): DuplicateGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const cp = (t.counterparty ?? "").trim().toLowerCase();
    if (!cp || !Number.isFinite(t.amount)) continue;
    const key = `${Math.abs(t.amount).toFixed(2)}|${cp}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const out: DuplicateGroup[] = [];
  for (const [key, transactions] of groups) {
    if (transactions.length >= 2) {
      const [amountStr, counterparty] = key.split("|");
      out.push({
        key,
        amount: Number(amountStr),
        counterparty,
        transactions,
      });
    }
  }
  // Les groupes les plus nombreux d'abord (signal le plus fort en tête).
  out.sort((a, b) => b.transactions.length - a.transactions.length);
  return out;
}
