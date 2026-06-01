import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import { slugify } from "@/lib/text";

type InpiDirigeant = {
  nom?: string;
  prenoms?: string;
  qualite?: string;
  type?: string;
};
type InpiResponse = { dirigeants?: InpiDirigeant[] };

export function normalizeInpi(
  raw: unknown,
  companyId: string,
): { entities: CaseEntity[]; edges: CaseEdge[] } {
  const dirigeants = (raw as InpiResponse).dirigeants ?? [];
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];

  for (const d of dirigeants) {
    const fullName = [d.prenoms, d.nom].filter(Boolean).join(" ").trim();
    if (!fullName) continue;
    const personId = `pe:${slugify(fullName)}`;
    if (!entities.some((e) => e.id === personId)) {
      entities.push({
        id: personId,
        type: "person",
        label: fullName,
        evidenceLevel: "declared",
        attributes: d.qualite ? { Qualité: d.qualite } : {},
        source: "INPI / RNE — dirigeants déclarés",
        excerpt: "Dirigeant déclaré au registre national des entreprises.",
      });
    }
    edges.push({
      id: `e:${personId}:${companyId}`,
      type: "DIRIGE",
      source: personId,
      target: companyId,
      label: d.qualite ?? "dirige",
      evidenceLevel: "declared",
      excerpt: d.qualite
        ? `${d.qualite} déclaré(e) au RNE.`
        : "Dirigeant déclaré au RNE.",
    });
  }
  return { entities, edges };
}
