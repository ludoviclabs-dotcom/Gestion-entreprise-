/**
 * Validation structurelle IBAN (ISO 13616) et BIC (ISO 9362) — sans dépendance.
 *
 * STRUCTURELLE uniquement : on vérifie le format et la clé de contrôle, jamais
 * le TITULAIRE (aucune source publique du titulaire — vie privée). L'usage
 * métier visé est la **réutilisation** d'un même IBAN entre entités comme signal
 * relationnel (`findSharedIbans`), pas la validation d'un compte bancaire.
 *
 * Modèle : src/lib/siren.ts (validation pure, sans I/O).
 */

/**
 * Longueurs IBAN officielles par pays (registre SWIFT, sous-ensemble UE/EEE +
 * voisins). Hors liste → on retombe sur la borne générique 15..34.
 */
const IBAN_LENGTHS: Record<string, number> = {
  FR: 27, DE: 22, GB: 22, ES: 24, IT: 27, BE: 16, NL: 18, LU: 20,
  PT: 25, CH: 21, IE: 22, AT: 20, PL: 28, FI: 18, SE: 24, DK: 18,
  NO: 15, MC: 27, LI: 21,
};

/** Retire espaces/tirets et met en capitales. */
export function normalizeIban(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** Code pays (2 lettres) d'un IBAN, ou null si la tête n'est pas conforme. */
export function ibanCountry(input: string): string | null {
  const iban = normalizeIban(input);
  return /^[A-Z]{2}/.test(iban) ? iban.slice(0, 2) : null;
}

/**
 * Valide la structure + la clé de contrôle ISO 13616 : déplacer les 4 premiers
 * caractères à la fin, convertir A→10..Z→35, puis vérifier mod 97 == 1.
 */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    // Lettre → deux chiffres (A=10 … Z=35) ; chiffre → lui-même.
    const piece =
      ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (let i = 0; i < piece.length; i += 1) {
      remainder = (remainder * 10 + (piece.charCodeAt(i) - 48)) % 97;
    }
  }
  return remainder === 1;
}

/** Valide la STRUCTURE d'un BIC/SWIFT (ISO 9362) : 8 ou 11 caractères. */
export function isValidBic(input: string): boolean {
  const bic = input.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic);
}

/**
 * Regroupe des entrées par IBAN normalisé et ne retient que les IBAN partagés
 * (≥ 2 entités distinctes) — signal relationnel de réutilisation. Pur ; les
 * IBAN invalides (clé KO) sont ignorés. La matérialisation en arêtes
 * `PARTAGE_IBAN` du graphe interviendra avec l'ingestion d'IBAN (couche
 * transactionnelle / import de documents).
 */
export function findSharedIbans(
  entries: { id: string; iban: string }[],
): { iban: string; entityIds: string[] }[] {
  const byIban = new Map<string, string[]>();
  for (const { id, iban } of entries) {
    const norm = normalizeIban(iban);
    if (!isValidIban(norm)) continue;
    const list = byIban.get(norm) ?? [];
    if (!list.includes(id)) list.push(id);
    byIban.set(norm, list);
  }
  const out: { iban: string; entityIds: string[] }[] = [];
  for (const [iban, ids] of byIban) {
    if (ids.length >= 2) out.push({ iban, entityIds: ids });
  }
  return out;
}
