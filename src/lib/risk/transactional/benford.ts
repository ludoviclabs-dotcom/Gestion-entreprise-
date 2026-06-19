/**
 * Loi de Benford (premier chiffre significatif). Détecteur d'anomalie
 * statistique sur une population de montants.
 *
 * ⚠️ LIMITES (à documenter dans toute restitution) : Benford ne s'applique qu'à
 * des données multi-échelles naturelles et suppose un effectif suffisant
 * (≥ ~50). Une déviation n'est PAS une preuve — c'est un signal à corroborer
 * (faisceau, validation humaine).
 */

/** Fréquences attendues du premier chiffre 1..9 : log10(1 + 1/d). */
export const BENFORD_EXPECTED = [
  0.30103, 0.17609, 0.12494, 0.09691, 0.07918, 0.06695, 0.05799, 0.05115, 0.04576,
];

/** Effectif minimal pour que le test ait un sens. */
export const BENFORD_MIN_SAMPLE = 50;
/** χ² critique à 8 degrés de liberté, α = 0,05. */
export const BENFORD_CHI2_CRITICAL = 15.51;

export type BenfordResult = {
  count: number;
  /** Fréquences observées du premier chiffre (9 valeurs). */
  observed: number[];
  expected: number[];
  chiSquare: number;
  /** χ² > seuil critique ET effectif suffisant. */
  deviates: boolean;
};

/** Premier chiffre significatif d'un nombre (|x|), ou null si non exploitable. */
export function firstDigit(x: number): number | null {
  let n = Math.abs(x);
  if (!Number.isFinite(n) || n === 0) return null;
  while (n >= 10) n /= 10;
  while (n < 1) n *= 10;
  const d = Math.floor(n);
  return d >= 1 && d <= 9 ? d : null;
}

export function benfordAnalysis(amounts: number[]): BenfordResult {
  const counts = new Array(9).fill(0);
  let total = 0;
  for (const amt of amounts) {
    const d = firstDigit(amt);
    if (d) {
      counts[d - 1] += 1;
      total += 1;
    }
  }
  const observed = counts.map((c) => (total > 0 ? c / total : 0));
  let chiSquare = 0;
  if (total > 0) {
    for (let i = 0; i < 9; i += 1) {
      const exp = BENFORD_EXPECTED[i] * total;
      chiSquare += ((counts[i] - exp) ** 2) / exp;
    }
  }
  return {
    count: total,
    observed,
    expected: BENFORD_EXPECTED,
    chiSquare,
    deviates: total >= BENFORD_MIN_SAMPLE && chiSquare > BENFORD_CHI2_CRITICAL,
  };
}
