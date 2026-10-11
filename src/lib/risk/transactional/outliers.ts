/**
 * Détection de montants aberrants par écart absolu médian (MAD) — robuste aux
 * valeurs extrêmes et DÉTERMINISTE (pas de tirage aléatoire, donc testable et
 * reproductible). Un score modifié de Iglewicz–Hoaglin :
 *   score = |x − médiane| / (1.4826 · MAD) ; aberrant si score > seuil (déf. 3.5).
 *
 * Choix assumé vs « isolation forest » : la forêt d'isolation est stochastique
 * (non déterministe sans graine) ; pour une preuve auditable et reproductible on
 * privilégie le MAD. L'isolation forest reste une option future si un besoin
 * multivarié émerge.
 */

export type AmountOutlier = { index: number; value: number; score: number };

function quantile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

/** Seuil par défaut du score modifié (Iglewicz–Hoaglin). */
export const OUTLIER_THRESHOLD = 3.5;

/**
 * Médiane et écart absolu médian (MAD) d'une population de montants — les deux
 * grandeurs qui expliquent un score d'aberrance. `null` si moins de 4 valeurs
 * finies (population trop petite pour conclure).
 */
export function robustDispersion(amounts: number[]): { median: number; mad: number } | null {
  const finite = amounts.filter((a) => Number.isFinite(a));
  if (finite.length < 4) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const absDev = finite.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  return { median, mad: quantile(absDev, 0.5) };
}

export function findAmountOutliers(
  amounts: number[],
  threshold = OUTLIER_THRESHOLD,
): AmountOutlier[] {
  const dispersion = robustDispersion(amounts);
  if (!dispersion) return [];
  const { median, mad } = dispersion;
  if (mad === 0) return []; // population trop homogène → pas d'aberrant exploitable.

  const out: AmountOutlier[] = [];
  amounts.forEach((x, index) => {
    if (!Number.isFinite(x)) return;
    const score = Math.abs(x - median) / (1.4826 * mad);
    if (score > threshold) out.push({ index, value: x, score });
  });
  out.sort((a, b) => b.score - a.score);
  return out;
}
