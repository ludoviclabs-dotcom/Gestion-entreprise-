"use server";

import { getCasesRepository } from "@/lib/data/cases-repository";
import { getGraphQueryRepository } from "@/lib/data/graph-query-repository";
import { isValidSiren, normalizeSiren } from "@/lib/siren";
import {
  validate,
  SearchQuerySchema,
  SirenSchema,
} from "@/lib/server/validate";
import type { CompanyCandidate } from "@/lib/data/types";

export async function searchCompaniesAction(
  q: string,
): Promise<CompanyCandidate[]> {
  const parsed = validate(q, SearchQuerySchema);
  if (!parsed.ok) return [];
  return getCasesRepository().searchCompanies(parsed.data);
}

export async function createCaseAction(
  siren: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Validation Zod : format de base (9 chiffres). Le contrôle Luhn (clé) reste
  // côté isValidSiren — Zod ne fait que la première barrière de surface.
  const parsed = validate(siren, SirenSchema);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const clean = normalizeSiren(parsed.data);
  if (!isValidSiren(clean)) {
    return { ok: false, error: "SIREN invalide (clé de Luhn incorrecte)." };
  }
  const summary = await getCasesRepository().createCaseFromSiren(clean);
  return { ok: true, id: summary.id };
}

/**
 * Calcule le plus court chemin entre deux entités d'un dossier, pondéré par
 * le niveau de preuve (`shortestEvidenceWeightedPath`). Renvoie la séquence
 * de nœuds ou un message d'erreur.
 */
export async function findPathAction(
  caseId: string,
  sourceId: string,
  targetId: string,
): Promise<
  | { ok: true; nodes: string[] }
  | { ok: false; error: string }
> {
  if (sourceId === targetId) {
    return { ok: false, error: "Source et cible identiques." };
  }
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) return { ok: false, error: "Dossier introuvable." };
  const nodes = await getGraphQueryRepository().shortestPath(
    detail.bundle,
    sourceId,
    targetId,
  );
  if (!nodes || nodes.length === 0) {
    return { ok: false, error: "Aucun chemin entre ces deux entités." };
  }
  return { ok: true, nodes };
}
