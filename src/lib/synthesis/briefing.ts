import type { CaseBundle } from "@/lib/graph/graph-types";
import { SEVERITY_LABELS } from "@/lib/graph/graph-types";

/**
 * System prompt strict imposé à Claude — extrait verbatim de l'ancienne route
 * API supprimée pour préserver les garde-fous (interdiction du mot « fraude »,
 * vocabulaire imposé, structure en 3 parties, 250 mots max). Le briefing
 * Markdown copié contient ce prompt en premier pour que la session Claude
 * Code respecte les mêmes règles que l'auto-génération aurait respectées.
 */
export const SYNTHESIS_SYSTEM_PROMPT = `Tu es un analyste de conformité KYB (Know-Your-Business) francophone.
Tu rédiges des synthèses opposables sur des dossiers d'investigation.

RÈGLES IMPÉRATIVES, sans aucune exception :
1. Tu N'UTILISES JAMAIS le mot « fraude » ni aucun synonyme accusatoire
   (escroquerie, abus, criminel, etc.). Tu emploies UNIQUEMENT le vocabulaire :
   « complexité », « vigilance », « qualité de preuve », « signal »,
   « hypothèse », « élément de vigilance ».
2. Tu rappelles le niveau de preuve des éléments cités quand pertinent :
   confirmé / déclaré / inféré / simulé. Les éléments inférés ou simulés
   sont des HYPOTHÈSES d'analyse, jamais des preuves.
3. Tu cites EXPLICITEMENT les règles déclenchées (ex. PROCEDURE_COLLECTIVE,
   ADRESSE_PARTAGEE) qui justifient ta lecture.
4. Tu structures la réponse en 3 parties courtes :
   a) « Synthèse » (2 phrases max)
   b) « Éléments de vigilance » (liste à puces)
   c) « À vérifier » (liste à puces, actions concrètes pour l'analyste)
5. Tu ne dépasses pas 250 mots au total.
6. Tu écris en français professionnel, neutre.`;

/**
 * Construit un briefing Markdown autonome (prompt + données) que l'utilisateur
 * colle dans sa session Claude Code pour obtenir la synthèse. Pur : ne fait
 * aucun I/O, exécutable côté serveur comme côté client.
 */
export function buildBriefing(bundle: CaseBundle): string {
  const { case: c, entities, edges, events, riskSignals } = bundle;

  const lines: string[] = [];
  lines.push(`# Briefing KYB Graph — ${c.title}`);
  lines.push("");

  // 1. Prompt système (à coller en tête)
  lines.push("## Consigne pour Claude (à respecter intégralement)");
  lines.push("");
  lines.push(SYNTHESIS_SYSTEM_PROMPT);
  lines.push("");

  // 2. Identité
  lines.push("## Identité du dossier");
  lines.push("");
  lines.push(`- **Titre** : ${c.title}`);
  lines.push(`- **SIREN** : ${c.rootSiren}`);
  if (c.scores) {
    const fmt = (v?: number) => (v === undefined || v === null ? "—" : String(v));
    lines.push(
      `- **Scores** : Complexité ${fmt(c.scores.complexite)} · Vigilance ${fmt(c.scores.vigilance)} · Qualité de preuve ${fmt(c.scores.qualitePreuve)}`,
    );
  }
  lines.push(
    `- **Compteurs** : ${entities.length} entités · ${edges.length} liens · ${events.length} événements · ${riskSignals.length} signaux`,
  );
  lines.push("");

  // 3. Signaux
  if (riskSignals.length > 0) {
    lines.push("## Signaux de vigilance détectés");
    lines.push("");
    for (const s of riskSignals) {
      lines.push(
        `- **${s.ruleId}** (${SEVERITY_LABELS[s.severity]} · ${s.category}) — ${s.explanation}`,
      );
    }
    lines.push("");
  }

  // 4. Événements marquants (procédure collective, radiation prioritaires)
  const priorityKinds = ["procedure_collective", "radiation"];
  const marquants = events.filter((e) => priorityKinds.includes(e.kind));
  if (marquants.length > 0) {
    lines.push("## Événements juridiques marquants");
    lines.push("");
    for (const e of marquants) {
      lines.push(
        `- ${e.occurredOn ?? "date inconnue"} · **${e.kind}** — ${e.title}`,
      );
    }
    lines.push("");
  }

  // 5. Demande explicite
  lines.push("---");
  lines.push("");
  lines.push(
    "**Demande** : Rédige la synthèse en suivant scrupuleusement les règles ci-dessus (3 parties, 250 mots max, jamais « fraude », citation explicite des règles déclenchées).",
  );

  return lines.join("\n");
}
