/**
 * Durées de collecte par source (ms), mesurées à la création d'un dossier et
 * conservées dans les métadonnées du dossier (aucune migration : colonne jsonb).
 * Clés : une source (`bodacc`, `gdelt`…), `sirene_siege`, et `_total`.
 *
 * Module pur, sûr côté serveur ET client.
 */
export type SourceTimings = Record<string, number>;

/** Lit les durées persistées ; ignore tout ce qui n'est pas un nombre fini ≥ 0. */
export function timingsOf(metadata: unknown): SourceTimings | undefined {
  const raw = (metadata as { timings?: unknown } | null | undefined)?.timings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: SourceTimings = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      out[key] = Math.round(value);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 412 → « 0,4 s » · 12 340 → « 12,3 s » (virgule française). */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/** Durées par source, de la plus lente à la plus rapide (le total en dernier). */
export function sortedTimings(timings: SourceTimings): [string, number][] {
  return Object.entries(timings)
    .filter(([key]) => key !== "_total")
    .sort((a, b) => b[1] - a[1]);
}
