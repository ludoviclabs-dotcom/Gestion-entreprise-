/**
 * Mesures de similarité de chaînes (pur TS, zéro dépendance) pour la résolution
 * d'entités. Jaro / Jaro-Winkler + un ratio insensible à l'ordre des mots.
 */
import { stripLegalForms } from "@/lib/match/normalize";

/** Similarité de Jaro ∈ [0, 1]. */
export function jaro(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.max(
    0,
    Math.floor(Math.max(a.length, b.length) / 2) - 1,
  );
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  transpositions /= 2;

  return (
    (matches / a.length +
      matches / b.length +
      (matches - transpositions) / matches) /
    3
  );
}

/** Jaro-Winkler : bonus pour préfixe commun (p = 0.1, max 4 caractères). */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i += 1) {
    if (a[i] === b[i]) prefix += 1;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

/**
 * Ratio insensible à l'ordre des mots : compare l'intersection triée des tokens
 * aux deux chaînes complètes. « Jean Martin » ≈ « Martin Jean » → 1.
 */
export function tokenSetRatio(a: string, b: string): number {
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return a === b ? 1 : 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  const inter = [...setA].filter((t) => setB.has(t)).sort();
  const onlyA = [...setA].filter((t) => !setB.has(t)).sort();
  const onlyB = [...setB].filter((t) => !setA.has(t)).sort();

  const s1 = inter.join(" ");
  const s2 = [...inter, ...onlyA].join(" ");
  const s3 = [...inter, ...onlyB].join(" ");

  return Math.max(jaroWinkler(s1, s2), jaroWinkler(s1, s3), jaroWinkler(s2, s3));
}

/**
 * Similarité de dénominations sociales : formes juridiques retirées de part et
 * d'autre, puis max(Jaro-Winkler, tokenSetRatio).
 */
export function denominationSimilarity(a: string, b: string): number {
  const na = stripLegalForms(a);
  const nb = stripLegalForms(b);
  if (!na || !nb) return 0;
  return Math.max(jaroWinkler(na, nb), tokenSetRatio(na, nb));
}
