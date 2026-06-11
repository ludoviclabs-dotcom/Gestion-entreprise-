"use server";

import { z } from "zod";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { getGraphQueryRepository } from "@/lib/data/graph-query-repository";
import { isValidSiren, normalizeSiren } from "@/lib/siren";
import {
  validate,
  SearchQuerySchema,
  SirenSchema,
} from "@/lib/server/validate";
import { validateSynthesisReferences } from "@/lib/synthesis/validate";
import type { CompanyCandidate } from "@/lib/data/types";

// Synthèse manuelle : entre 20 et 5000 caractères, sans HTML brut.
const SynthesisSchema = z
  .string()
  .trim()
  .min(20, "Réponse trop courte (minimum 20 caractères).")
  .max(5000, "Réponse trop longue (maximum 5000 caractères).");

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

/**
 * Persiste la synthèse manuelle d'un dossier (workflow Claude Code copier-coller).
 * Une seule version par dossier ; toute nouvelle sauvegarde écrase l'ancienne.
 * Garde-fou : la réponse doit citer au moins une règle déclenchée du dossier
 * (consigne 3 du briefing) — les identifiants cités sont journalisés.
 */
export async function saveSynthesisAction(
  caseId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = validate(content, SynthesisSchema);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    const repository = getCasesRepository();
    const detail = await repository.getCase(caseId);
    if (!detail) return { ok: false, error: "Dossier introuvable." };

    const references = validateSynthesisReferences(parsed.data, detail.bundle);
    if (!references.ok) return { ok: false, error: references.error };

    await repository.saveSynthesis(
      caseId,
      parsed.data,
      references.referencedRuleIds,
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement de la synthèse.",
    };
  }
}
