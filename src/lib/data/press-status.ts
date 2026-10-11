import { isDegradedEndpoint } from "@/lib/connectors/degraded";

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

/**
 * La presse a été interrogée mais n'a abouti à aucune consultation réelle réussie :
 * toutes les lignes GDELT du dossier sont en erreur HTTP ou dégradées (429,
 * délai dépassé, réponse non JSON…). Sans ligne GDELT : `false` (rien n'a été tenté
 * — c'est `pressOf` qui le dit). Les fixtures ne comptent pas.
 */
export function isPressConsultationFailed(
  sources: readonly { source: string; endpoint: string; httpStatus: number; isFixture: boolean }[],
): boolean {
  const gdelt = sources.filter((s) => s.source === "gdelt" && !s.isFixture);
  if (gdelt.length === 0) return false;
  return gdelt.every((s) => s.httpStatus >= 400 || s.httpStatus === 0 || isDegradedEndpoint(s.endpoint));
}

/**
 * Collecte « en attente » depuis trop longtemps : interrompue, pas en cours.
 * Sans horodatage de la demande on ne peut pas prouver qu'elle est en cours :
 * elle est présentée comme interrompue plutôt que « en cours » indéfiniment.
 */
export function isPressStale(status: PressStatus, now: number = Date.now()): boolean {
  if (status.state !== "pending") return false;
  if (!status.requestedAt) return true;
  const at = Date.parse(status.requestedAt);
  return !Number.isFinite(at) || now - at > PRESS_STALE_MS;
}
