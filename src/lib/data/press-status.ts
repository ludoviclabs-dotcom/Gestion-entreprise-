/**
 * État de la collecte de PRESSE (GDELT) d'un dossier, conservé dans les
 * métadonnées du dossier (colonne jsonb, aucune migration).
 *
 * La presse (10 à 15 s) n'est plus attendue à la création : le dossier est servi
 * sans elle, puis complété. Tant qu'elle n'est pas collectée, la source n'est PAS
 * interrogée — ce n'est ni « aucun article » ni une panne.
 *
 * Module pur, sûr côté serveur ET client.
 */
export type PressState = "pending" | "done" | "failed";

export type PressStatus = {
  state: PressState;
  requestedAt?: string;
  completedAt?: string;
};

/** Au-delà, une collecte « en attente » est considérée interrompue (fonction coupée). */
export const PRESS_STALE_MS = 10 * 60 * 1000;

export function pressOf(metadata: unknown): PressStatus | undefined {
  const raw = (metadata as { press?: unknown } | null | undefined)?.press;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const { state, requestedAt, completedAt } = raw as Record<string, unknown>;
  if (state !== "pending" && state !== "done" && state !== "failed") return undefined;
  return {
    state,
    ...(typeof requestedAt === "string" ? { requestedAt } : {}),
    ...(typeof completedAt === "string" ? { completedAt } : {}),
  };
}

/** Collecte « en attente » depuis trop longtemps : interrompue, pas en cours. */
export function isPressStale(status: PressStatus, now: number = Date.now()): boolean {
  if (status.state !== "pending" || !status.requestedAt) return false;
  const at = Date.parse(status.requestedAt);
  return Number.isFinite(at) && now - at > PRESS_STALE_MS;
}
