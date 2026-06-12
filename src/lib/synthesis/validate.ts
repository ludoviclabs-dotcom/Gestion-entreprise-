import type { CaseBundle } from "@/lib/graph/graph-types";

/**
 * Garde-fou du workflow de synthèse manuelle : la réponse collée doit citer
 * au moins un identifiant de règle réellement déclenchée sur le dossier
 * (consigne 3 du briefing). Évite les synthèses hors-sol — chaque phrase
 * d'analyse reste rattachable à un signal vérifiable. Pur.
 */

/** Identifiants de règles déclenchées cités dans le texte. */
export function referencedRuleIds(content: string, bundle: CaseBundle): string[] {
  const triggered = [...new Set(bundle.riskSignals.map((s) => s.ruleId))];
  return triggered.filter((ruleId) => content.includes(ruleId));
}

export function validateSynthesisReferences(
  content: string,
  bundle: CaseBundle,
): { ok: true; referencedRuleIds: string[] } | { ok: false; error: string } {
  const triggered = [...new Set(bundle.riskSignals.map((s) => s.ruleId))];
  // Dossier sans signal : rien à citer, la synthèse passe.
  if (triggered.length === 0) return { ok: true, referencedRuleIds: [] };

  const cited = referencedRuleIds(content, bundle);
  if (cited.length === 0) {
    return {
      ok: false,
      error: `La synthèse doit citer au moins une règle déclenchée sur ce dossier (${triggered.join(", ")}) — cf. consigne 3 du briefing.`,
    };
  }
  return { ok: true, referencedRuleIds: cited };
}
