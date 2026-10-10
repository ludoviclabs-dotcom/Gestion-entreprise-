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

/**
 * Registres GLEIF (codes RA) de Companies House : Angleterre et Pays de Galles,
 * Irlande du Nord, Écosse. Vérifiés sur l'API GLEIF (registration-authorities).
 */
const COMPANIES_HOUSE_RA = new Set(["RA000585", "RA000586", "RA000587"]);

/**
 * Sociétés mères (directe / ultime) immatriculées à Companies House, avec leur
 * LEI : cibles du second saut Companies House. Dédoublonné par numéro. Pur.
 */
export function companiesHouseParents(
  raw: unknown,
): { lei: string; number: string }[] {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<GleifSimplified>;
  const out: { lei: string; number: string }[] = [];
  for (const p of [data.directParent, data.ultimateParent]) {
    if (!p?.lei || !p.registeredAs || !p.registrationAuthority) continue;
    if (!COMPANIES_HOUSE_RA.has(p.registrationAuthority)) continue;
    if (out.some((x) => x.number === p.registeredAs)) continue;
    out.push({ lei: p.lei, number: p.registeredAs });
  }
  return out;
}

function parentEntity(p: GleifEntityLite): CaseEntity {
  return {
    id: `co:lei:${p.lei}`,
    type: "company",
    label: p.legalName ?? `LEI ${p.lei}`,
    evidenceLevel: "declared",
    attributes: {
      LEI: p.lei,
      ...(p.country ? { Pays: p.country } : {}),
      ...(p.registeredAs ? { "N° au registre": p.registeredAs } : {}),
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
