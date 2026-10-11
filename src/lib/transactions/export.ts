import Papa from "papaparse";
import {
  RISK_LABELS,
  TRIAGE_LABELS,
  type TriageStatus,
  type TriagedTransaction,
} from "./triage";

/**
 * Cellule qu'un tableur pourrait interpréter comme une formule (= + - @, tabulation,
 * retour chariot, et leurs variantes pleine chasse), SAUF un simple nombre signé
 * (« -1 200,50 ») : un montant négatif doit rester un nombre, pas devenir du texte.
 */
export const FORMULA_TRIGGER = /^(?![-+]?\d[\d\s.,]*$)[=+\-@\t\r＝＋－＠]/;

/**
 * Export CSV de la vue de triage : colonnes d'origine du fichier (TOUTES, dans
 * leur ordre — jamais déduites de la seule première ligne), puis signaux,
 * motifs, vigilance et statut. Les valeurs proviennent de tiers : toute cellule
 * qui démarrerait une formule est neutralisée (préfixe « ' »).
 */
export function buildTriageCsv(
  items: TriagedTransaction[],
  statusOf: (id: string) => TriageStatus,
  sourceColumns: string[],
): string {
  const fields = ["ligne", ...sourceColumns, "signaux", "motifs", "vigilance", "statut_triage"];
  const rows = items.map((t) => [
    t.line,
    ...sourceColumns.map((c) => t.raw[c] ?? ""),
    t.signals.map((s) => s.label).join(" ; "),
    t.signals.map((s) => s.motif).join(" | "),
    RISK_LABELS[t.risk],
    TRIAGE_LABELS[statusOf(t.id)],
  ]);
  return Papa.unparse({ fields, data: rows }, { escapeFormulae: FORMULA_TRIGGER });
}

/** Colonnes d'origine dans l'ordre de première apparition (en-tête du fichier). */
export function sourceColumnsOf(items: { raw: Record<string, string> }[]): string[] {
  const seen = new Set<string>();
  for (const t of items) for (const k of Object.keys(t.raw)) seen.add(k);
  return [...seen];
}
