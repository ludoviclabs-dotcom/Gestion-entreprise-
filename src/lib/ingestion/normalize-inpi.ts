import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import { slugify } from "@/lib/text";
import { isInpiUboExposed } from "@/lib/env";

type InpiDirigeant = {
  nom?: string;
  prenoms?: string;
  qualite?: string;
  type?: string;
  denomination?: string;
  siren?: string;
};
type InpiBeneficiaire = {
  nom?: string;
  prenoms?: string;
  modaliteControle?: string;
};
type InpiResponse = {
  dirigeants?: InpiDirigeant[];
  beneficiairesEffectifs?: InpiBeneficiaire[];
};

function pushUnique(entities: CaseEntity[], entity: CaseEntity): void {
  if (!entities.some((e) => e.id === entity.id)) entities.push(entity);
}

export function normalizeInpi(
  raw: unknown,
  companyId: string,
): { entities: CaseEntity[]; edges: CaseEdge[] } {
  const data = (raw && typeof raw === "object" ? raw : {}) as InpiResponse;
  const dirigeants = data.dirigeants ?? [];
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];

  for (const d of dirigeants) {
    // Dirigeant personne morale (société qui dirige).
    if (d.type === "personne_morale" || (d.denomination && !d.nom)) {
      const denom = d.denomination?.trim();
      if (!denom) continue;
      const id = d.siren ? `co:${d.siren}` : `co:${slugify(denom)}`;
      pushUnique(entities, {
        id,
        type: "company",
        label: denom,
        evidenceLevel: "declared",
        attributes: {
          ...(d.qualite ? { Qualité: d.qualite } : {}),
          ...(d.siren ? { SIREN: d.siren } : {}),
        },
        source: "INPI / RNE — dirigeant personne morale",
        excerpt: "Personne morale dirigeante déclarée au RNE.",
      });
      edges.push({
        id: `e:${id}:${companyId}`,
        type: "DIRIGE",
        source: id,
        target: companyId,
        label: d.qualite ?? "dirige",
        evidenceLevel: "declared",
        excerpt: d.qualite
          ? `${d.qualite} déclaré(e) au RNE.`
          : "Dirigeant personne morale déclaré au RNE.",
      });
      continue;
    }

    // Dirigeant personne physique.
    const fullName = [d.prenoms, d.nom].filter(Boolean).join(" ").trim();
    if (!fullName) continue;
    const personId = `pe:${slugify(fullName)}`;
    pushUnique(entities, {
      id: personId,
      type: "person",
      label: fullName,
      evidenceLevel: "declared",
      attributes: d.qualite ? { Qualité: d.qualite } : {},
      source: "INPI / RNE — dirigeants déclarés",
      excerpt: "Dirigeant déclaré au registre national des entreprises.",
    });
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

  // Bénéficiaires effectifs (UBO) — GATÉS par garde-fou CJUE 2022. Tant que
  // l'auth + le log d'intérêt légitime (Étapes 2.2 / 3.4) ne sont pas en place,
  // on n'expose pas les UBO réels dans le graphe (cf. docs/regulatory.md).
  if (isInpiUboExposed()) {
    for (const b of data.beneficiairesEffectifs ?? []) {
      const fullName = [b.prenoms, b.nom].filter(Boolean).join(" ").trim();
      if (!fullName) continue;
      const personId = `pe:${slugify(fullName)}`;
      pushUnique(entities, {
        id: personId,
        type: "person",
        label: fullName,
        evidenceLevel: "declared",
        attributes: {
          "Bénéficiaire effectif": "oui",
          ...(b.modaliteControle ? { Contrôle: b.modaliteControle } : {}),
        },
        source: "INPI / RNE — bénéficiaires effectifs",
        excerpt:
          "Bénéficiaire effectif déclaré au RNE (accès intérêt légitime, CJUE 2022).",
      });
      edges.push({
        id: `e:ubo:${personId}:${companyId}`,
        type: "DETIENT",
        source: personId,
        target: companyId,
        label: b.modaliteControle ?? "bénéficiaire effectif",
        evidenceLevel: "declared",
        excerpt:
          "Détention/contrôle déclaré(e) au registre des bénéficiaires effectifs.",
      });
    }
  }

  return { entities, edges };
}
