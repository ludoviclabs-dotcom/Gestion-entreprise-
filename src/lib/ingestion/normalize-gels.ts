import type { CaseEntity, CaseEdge, EvidenceLevel } from "@/lib/graph/graph-types";
import { slugify } from "@/lib/text";

type GelsMatch = {
  nom?: string;
  type?: string;
  matchType?: string;
  registre?: string;
};
type GelsResponse = { matches?: GelsMatch[] };

export function normalizeGels(
  raw: unknown,
  ctx: { companyId: string },
): { entities: CaseEntity[]; edges: CaseEdge[] } {
  const matches = (raw as GelsResponse).matches ?? [];
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];

  for (const m of matches) {
    if (!m.nom) continue;
    // Exact → 'declared' ; sinon hypothèse → 'simulated'. JAMAIS 'confirmed'.
    const level: EvidenceLevel = m.matchType === "exact" ? "declared" : "simulated";
    const sanctionId = `sa:${slugify(m.nom)}`;
    entities.push({
      id: sanctionId,
      type: "sanction",
      label: `Correspondance « ${m.nom} »`,
      evidenceLevel: level,
      attributes: {
        Registre: m.registre ?? "Gels des avoirs (DG Trésor)",
        Type:
          m.matchType === "exact"
            ? "Correspondance exacte"
            : "Correspondance approximative",
      },
      source: "DG Trésor — registre national des gels",
      excerpt:
        "Rapprochement avec le registre des gels — à vérifier manuellement, aucune certitude.",
    });
    edges.push({
      id: `e:${ctx.companyId}:${sanctionId}`,
      type: "EST_VISE_PAR",
      source: ctx.companyId,
      target: sanctionId,
      label: "correspondance possible",
      evidenceLevel: level,
      excerpt: "Rapprochement nominatif — hypothèse à vérifier.",
    });
  }
  return { entities, edges };
}
