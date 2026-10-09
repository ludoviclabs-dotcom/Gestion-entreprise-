import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type {
  PappersResult,
  PappersFinance,
  PappersPerson,
} from "@/lib/connectors/pappers";
import { slugify } from "@/lib/text";

export type PappersNormalized = {
  finances: PappersFinance | null;
  financialAttributes: Record<string, string>;
};

const SOURCE_LABEL = "Pappers — dirigeants";

/**
 * Dirigeants (personnes physiques et morales) déclarés, vus par Pappers.
 *
 * Appelée AVANT la résolution d'entités : un même dirigeant vu par l'INPI et par
 * Pappers est fusionné par le résolveur (et l'arête INPI, première dans
 * `dedupeById`, l'emporte à identifiant égal). Les ids reprennent le schéma de
 * `normalizeInpi` (`pe:` / `co:`).
 *
 * ⚠️ Les bénéficiaires effectifs (`beneficiaires_effectifs`) ne sont VOLONTAIREMENT
 * pas lus : leur exposition est gardée par INPI_EXPOSE_UBO (CJUE 2022) et un
 * agrégateur ne lève pas cette obligation. La date de naissance n'est pas
 * reprise non plus (minimisation des données).
 */
export function pappersDirigeants(
  raw: unknown,
  companyId: string,
): { entities: CaseEntity[]; edges: CaseEdge[] } {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<PappersResult>;
  const people: PappersPerson[] = [
    ...(Array.isArray(data.representants) ? data.representants : []),
    ...(Array.isArray(data.dirigeants) ? data.dirigeants : []),
  ];
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];
  const seen = new Set<string>();

  const text = (v: string | null | undefined): string => (v ?? "").trim();

  for (const p of people) {
    const qualite = text(p.qualite);
    const prenomNom = [text(p.prenom), text(p.nom)].filter(Boolean).join(" ");
    const isLegal =
      p.personne_morale === true || (!prenomNom && Boolean(text(p.denomination)));

    let id: string;
    let entity: CaseEntity;
    if (isLegal) {
      const denom = text(p.denomination) || text(p.nom_complet) || text(p.nom);
      if (!denom) continue;
      const siren = text(p.siren).replace(/\s+/g, "");
      id = siren ? `co:${siren}` : `co:${slugify(denom)}`;
      entity = {
        id,
        type: "company",
        label: denom,
        evidenceLevel: "declared",
        attributes: {
          ...(qualite ? { Qualité: qualite } : {}),
          ...(siren ? { SIREN: siren } : {}),
        },
        source: `${SOURCE_LABEL} (personne morale)`,
        excerpt: "Personne morale dirigeante, agrégée par Pappers.",
      };
    } else {
      const name = prenomNom || text(p.nom_complet);
      if (!name) continue;
      id = `pe:${slugify(name)}`;
      entity = {
        id,
        type: "person",
        label: name,
        evidenceLevel: "declared",
        attributes: qualite ? { Qualité: qualite } : {},
        source: SOURCE_LABEL,
        excerpt: "Dirigeant déclaré, agrégé par Pappers.",
      };
    }

    if (seen.has(id)) continue;
    seen.add(id);
    entities.push(entity);
    edges.push({
      id: `e:${id}:${companyId}`,
      type: "DIRIGE",
      source: id,
      target: companyId,
      label: qualite || "dirige",
      evidenceLevel: "declared",
      excerpt: qualite
        ? `${qualite} déclaré(e), agrégé par Pappers.`
        : "Dirigeant déclaré, agrégé par Pappers.",
    });
  }
  return { entities, edges };
}

export function normalizePappers(
  raw: unknown,
  subjectCompanyId: string,
  entities: CaseEntity[],
): PappersNormalized {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<PappersResult>;

  // Exercice le plus récent (trié par année décroissante)
  const sorted = [...(data.finances ?? [])].sort((a, b) => b.annee - a.annee);
  const latest: PappersFinance | null = sorted[0] ?? null;

  const financialAttributes: Record<string, string> = {};
  if (latest) {
    if (latest.chiffre_affaires != null) {
      financialAttributes["CA (dernier exercice)"] =
        `${latest.chiffre_affaires.toLocaleString("fr-FR")} € (${latest.annee})`;
    }
    if (latest.resultat_net != null) {
      financialAttributes["Résultat net"] =
        `${latest.resultat_net.toLocaleString("fr-FR")} € (${latest.annee})`;
    }
    if (latest.capitaux_propres != null) {
      financialAttributes["Capitaux propres"] =
        `${latest.capitaux_propres.toLocaleString("fr-FR")} € (${latest.annee})`;
    }
    if (latest.effectif != null) {
      financialAttributes["Effectif déclaré"] =
        `${latest.effectif.toLocaleString("fr-FR")} (${latest.annee})`;
    }
  }

  // Enrichir le nœud sujet canonique avec les attributs financiers
  const subject = entities.find((e) => e.id === subjectCompanyId);
  if (subject && Object.keys(financialAttributes).length > 0) {
    subject.attributes = { ...subject.attributes, ...financialAttributes };
  }

  return { finances: latest, financialAttributes };
}
