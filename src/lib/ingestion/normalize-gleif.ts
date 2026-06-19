import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type { GleifSimplified, GleifEntityLite } from "@/lib/connectors/gleif";
import { slugify } from "@/lib/text";

/**
 * Normalise la sortie simplifiée de GLEIF en nœuds société (mères de
 * consolidation transfrontalières) + arêtes `DETIENT` STRUCTURELLES (sans %,
 * `declared`). Renvoie aussi le `subjectLei` pour enrichir le nœud société
 * racine (mergé dans `assembleCase`). Ne lève jamais (entrée défensive).
 */
export type GleifNormalized = {
  entities: CaseEntity[];
  edges: CaseEdge[];
  subjectLei: string | null;
};

function parentEntity(p: GleifEntityLite): CaseEntity {
  return {
    id: `co:lei:${p.lei}`,
    type: "company",
    label: p.legalName ?? `LEI ${p.lei}`,
    evidenceLevel: "declared",
    attributes: {
      LEI: p.lei,
      ...(p.country ? { Pays: p.country } : {}),
    },
    source: "GLEIF — société mère (niveau 2)",
    excerpt: "Société mère de consolidation déclarée au référentiel GLEIF (LEI).",
  };
}

export function normalizeGleif(
  raw: unknown,
  subjectCompanyId: string,
): GleifNormalized {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<GleifSimplified>;
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];
  const seen = new Set<string>();

  const parents: [GleifEntityLite | null | undefined, string][] = [
    [data.directParent, "mère directe"],
    [data.ultimateParent, "mère ultime"],
  ];

  for (const [parent, kind] of parents) {
    if (!parent?.lei) continue;
    const id = `co:lei:${parent.lei}`;
    // Une seule arête par mère : si la mère ultime == la mère directe, on garde
    // la mère directe (déjà vue) et on n'ajoute pas de doublon.
    if (seen.has(id)) continue;
    seen.add(id);
    entities.push(parentEntity(parent));
    edges.push({
      id: `e:gleif:${id}:${subjectCompanyId}:${slugify(kind)}`,
      type: "DETIENT",
      source: id,
      target: subjectCompanyId,
      label: kind,
      evidenceLevel: "declared",
      excerpt: `Consolidation (${kind}) déclarée au référentiel GLEIF — sans pourcentage publié.`,
    });
  }

  return { entities, edges, subjectLei: data.subject?.lei ?? null };
}
