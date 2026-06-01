"use server";

import { getCasesRepository } from "@/lib/data/cases-repository";
import { isValidSiren, normalizeSiren } from "@/lib/siren";
import type { CompanyCandidate } from "@/lib/data/types";

export async function searchCompaniesAction(
  q: string,
): Promise<CompanyCandidate[]> {
  if (!q.trim()) return [];
  return getCasesRepository().searchCompanies(q.trim());
}

export async function createCaseAction(
  siren: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const clean = normalizeSiren(siren);
  if (!isValidSiren(clean)) {
    return { ok: false, error: "SIREN invalide (9 chiffres, clé de Luhn)." };
  }
  const summary = await getCasesRepository().createCaseFromSiren(clean);
  return { ok: true, id: summary.id };
}
