/**
 * Parsing robuste d'un montant depuis une cellule CSV (formats FR et US).
 * Le DERNIER séparateur rencontré est la décimale ; l'autre est le milliers :
 *  - « 1.234,56 » (FR) → 1234.56     - « 1,234.56 » (US) → 1234.56
 *  - « 1234,56 » → 1234.56           - « 1234.56 » → 1234.56
 *  - « 1 234,56 » → 1234.56          - « 1.234 » → 1.234 (point seul = décimale)
 * Renvoie NaN si non numérique. Pur (testable) — utilisé par l'analyse
 * transactionnelle locale (aucune donnée n'est envoyée au serveur).
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".") // FR : 1.234,56
        : s.replace(/,/g, ""); // US : 1,234.56
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : Number.NaN;
}
