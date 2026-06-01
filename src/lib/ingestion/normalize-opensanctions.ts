import type {
  CaseEdge,
  CaseEntity,
  EvidenceLevel,
} from "@/lib/graph/graph-types";
import { slugify } from "@/lib/text";

type OSMatch = {
  id: string;
  caption?: string;
  schema?: string;
  score?: number;
  match?: boolean;
  properties?: { name?: string[]; datasets?: string[] };
};
type OSResponse = {
  responses?: Record<string, { results?: OSMatch[] }>;
};

/**
 * Mappe la réponse OpenSanctions en entités `sanction` + liens `EST_VISE_PAR`.
 * Seuils :
 *  - match=true (id exact) → evidence `declared`
 *  - score ≥ 0.85          → evidence `simulated` (badge « à vérifier »)
 *  - score <  0.85         → ignoré (trop bruyant pour un dossier KYB)
 *
 * Source du seuil 0.85 : conventions OpenSanctions (`match=true` ≈ ≥ 0.7,
 * marge supplémentaire pour réduire les faux positifs sur les noms communs).
 */
export function normalizeOpenSanctions(
  raw: unknown,
  ctx: { subjectId: string; subjectLabel: string },
): { entities: CaseEntity[]; edges: CaseEdge[] } {
  const responses = (raw as OSResponse).responses ?? {};
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];

  for (const queryKey of Object.keys(responses)) {
    const results = responses[queryKey]?.results ?? [];
    for (const m of results) {
      const score = m.score ?? 0;
      const exact = m.match === true || m.id?.startsWith("ofac:") === true;
      if (!exact && score < 0.85) continue;
      const level: EvidenceLevel = exact ? "declared" : "simulated";

      const name = m.caption ?? m.properties?.name?.[0] ?? `Match ${m.id}`;
      const sanctionId = `sa:opensanctions:${slugify(m.id)}`;
      const datasets = (m.properties?.datasets ?? []).join(", ");

      entities.push({
        id: sanctionId,
        type: "sanction",
        label: `Correspondance « ${name} »`,
        evidenceLevel: level,
        attributes: {
          Source: "OpenSanctions",
          "Identifiant OS": m.id,
          Score: `${Math.round(score * 100)} %`,
          Datasets: datasets || "—",
          Niveau: exact ? "Correspondance exacte" : "Correspondance approximative",
        },
        source: "OpenSanctions — base ouverte EU sanctions/PEP",
        excerpt: exact
          ? `Match exact pour ${ctx.subjectLabel} dans ${datasets || "OpenSanctions"}.`
          : `Match approximatif (score ${Math.round(score * 100)} %) — à vérifier manuellement.`,
      });

      edges.push({
        id: `e:${ctx.subjectId}:${sanctionId}`,
        type: "EST_VISE_PAR",
        source: ctx.subjectId,
        target: sanctionId,
        label: exact ? "correspondance exacte" : "correspondance possible",
        evidenceLevel: level,
        excerpt: exact
          ? "Sujet présent sur une liste officielle de sanctions/PEP."
          : "Rapprochement nominatif — hypothèse à vérifier.",
      });
    }
  }

  return { entities, edges };
}
