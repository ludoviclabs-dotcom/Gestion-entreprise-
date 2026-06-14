import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import { slugify } from "@/lib/text";

/**
 * Normalise une extraction Docling (Kbis/statuts) en entités/liens KYB. Les
 * identifiants suivent la même convention (`co:`/`pe:`/`ad:` via slugify) que
 * Sirene/INPI, afin que la résolution d'entités fusionne les recoupements.
 *
 * Garde-fou : on ne mappe que les dirigeants (publics sur un Kbis), jamais les
 * bénéficiaires effectifs (gating CJUE, cf. normalize-inpi).
 */
export type DoclingExtraction = {
  document?: string;
  confidence?: number;
  company?: { siren?: string; denomination: string };
  dirigeants?: { nom?: string; prenoms?: string; qualite?: string }[];
  address?: { label: string };
};

export function normalizeDocling(raw: unknown): {
  entities: CaseEntity[];
  edges: CaseEdge[];
} {
  const data = (raw && typeof raw === "object" ? raw : {}) as DoclingExtraction;
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];
  const docLabel = `Docling — ${data.document ?? "extraction"}`;

  if (!data.company?.denomination) return { entities, edges };

  const siren = data.company.siren?.replace(/\s+/g, "");
  const companyId = siren
    ? `co:${siren}`
    : `co:${slugify(data.company.denomination)}`;
  entities.push({
    id: companyId,
    type: "company",
    label: data.company.denomination,
    evidenceLevel: "declared",
    attributes: siren ? { SIREN: siren } : {},
    source: docLabel,
    excerpt: "Société extraite d'un document (Kbis/statuts).",
  });

  for (const d of data.dirigeants ?? []) {
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
        source: docLabel,
        excerpt: "Dirigeant extrait du document.",
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
        ? `${d.qualite} extrait(e) du document.`
        : "Dirigeant extrait du document.",
    });
  }

  if (data.address?.label) {
    const addressId = `ad:${slugify(data.address.label)}`;
    entities.push({
      id: addressId,
      type: "address",
      label: data.address.label,
      evidenceLevel: "declared",
      attributes: { Pays: "France" },
      source: docLabel,
      excerpt: "Adresse extraite du document.",
    });
    edges.push({
      id: `e:${companyId}:${addressId}`,
      type: "PARTAGE_ADRESSE",
      source: companyId,
      target: addressId,
      label: "siège",
      evidenceLevel: "declared",
      excerpt: "Siège extrait du document.",
    });
  }

  return { entities, edges };
}
