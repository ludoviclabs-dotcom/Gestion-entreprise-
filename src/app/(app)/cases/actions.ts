"use server";

import { getCasesRepository } from "@/lib/data/cases-repository";
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
