import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { hasAnthropicKey } from "@/lib/env";
import {
  SEVERITY_LABELS,
} from "@/lib/graph/graph-types";

export const runtime = "nodejs";

/**
 * Synthèse IA d'un dossier : Claude résume le profil de risque en s'appuyant
 * sur les signaux calculés + entités + événements. Garde-fous stricts :
 *  - vocabulaire imposé (complexité/vigilance/qualité de preuve),
 *  - INTERDICTION explicite du mot « fraude »,
 *  - obligation de citer les règles déclenchées,
 *  - rappel des niveaux de preuve.
 *
 * Sans ANTHROPIC_API_KEY → réponse 503 avec message explicite.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  if (!hasAnthropicKey()) {
    return new Response(
      JSON.stringify({
        error:
          "Synthèse IA non disponible — la variable ANTHROPIC_API_KEY n'est pas configurée.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { caseId } = await params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) return new Response("Dossier introuvable", { status: 404 });
  const { bundle } = detail;

  // Compact briefing — limite stricte pour économiser les tokens et garder
  // la réponse focalisée.
  const briefing = {
    titre: bundle.case.title,
    siren: bundle.case.rootSiren,
    scores: bundle.case.scores,
    compteurs: {
      entités: bundle.entities.length,
      liens: bundle.edges.length,
      événements: bundle.events.length,
      signaux: bundle.riskSignals.length,
    },
    signaux: bundle.riskSignals.map((s) => ({
      règle: s.ruleId,
      sévérité: SEVERITY_LABELS[s.severity],
      catégorie: s.category,
      explication: s.explanation,
    })),
    événements_marquants: bundle.events
      .filter((e) =>
        ["procedure_collective", "radiation"].includes(e.kind),
      )
      .map((e) => ({ kind: e.kind, date: e.occurredOn, titre: e.title })),
  };

  const systemPrompt = `Tu es un analyste de conformité KYB (Know-Your-Business) francophone.
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

  const userPrompt = `Voici le briefing d'un dossier de cartographie KYB. Rédige la synthèse.

Briefing :
\`\`\`json
${JSON.stringify(briefing, null, 2)}
\`\`\``;

  const result = streamText({
    model: anthropic("claude-3-5-sonnet-latest"),
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxOutputTokens: 800,
  });

  return result.toTextStreamResponse();
}
