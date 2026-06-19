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

export function findAmountOutliers(
  amounts: number[],
  threshold = 3.5,
): AmountOutlier[] {
  const finite = amounts.filter((a) => Number.isFinite(a));
  if (finite.length < 4) return [];
  const sorted = [...finite].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const absDev = finite.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
  const mad = quantile(absDev, 0.5);
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
