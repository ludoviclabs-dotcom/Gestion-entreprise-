import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type {
  RechercheEntreprisesRaw,
  ReDirigeant,
} from "@/lib/connectors/recherche-entreprises";
import { slugify } from "@/lib/text";

const SOURCE_LABEL = "Recherche d'entreprises — dirigeants (RNE)";
const EDGE_SOURCE = "Recherche d'entreprises (RNE)";

const isAuditor = (d: ReDirigeant): boolean =>
  /commissaire\s+aux\s+comptes/i.test(d.qualite ?? "");

const asData = (raw: unknown): Partial<RechercheEntreprisesRaw> =>
  (raw && typeof raw === "object" ? raw : {}) as Partial<RechercheEntreprisesRaw>;

function displayName(d: ReDirigeant): string {
  return [d.prenoms, d.nom].filter(Boolean).join(" ").trim();
}

/**
 * Dirigeants publiés au RNE, vus par « Recherche d'entreprises » → nœuds
 * person/company + arêtes `DIRIGE` (déclarées).
 *
 * Appelée AVANT la résolution d'entités : un dirigeant vu par plusieurs sources
 * (INPI, Pappers, ici) est fusionné. Mêmes schémas d'id que `normalizeInpi`
 * (`pe:` / `co:`).
 *
 * ⚠️ Les COMMISSAIRES AUX COMPTES sont publiés dans la même liste mais ne
 * dirigent pas : ils ne deviennent PAS des arêtes `DIRIGE` (une firme d'audit
 * apparaîtrait comme « dirigeant » de dizaines de sociétés et fausserait les
 * règles de gouvernance). Ils sont repris en attribut (`rechercheAttributes`).
 * Aucune date de naissance ni nationalité n'est conservée (minimisation).
 */
export function rechercheDirigeants(
  raw: unknown,
  companyId: string,
): { entities: CaseEntity[]; edges: CaseEdge[] } {
  const data = asData(raw);
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];
  const seen = new Set<string>();
  if (data.status !== "ok") return { entities, edges };

  for (const d of Array.isArray(data.dirigeants) ? data.dirigeants : []) {
    if (!d || isAuditor(d)) continue;
    const qualite = (d.qualite ?? "").trim();

    const legal = d.type === "personne morale" || (!displayName(d) && Boolean(d.denomination));
    let id: string;
    let entity: CaseEntity;
    if (legal) {
      const denom = (d.denomination ?? "").trim();
      if (!denom) continue;
      const siren = (d.siren ?? "").replace(/\s+/g, "");
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
        source: `${SOURCE_LABEL} — personne morale`,
        excerpt: "Personne morale dirigeante publiée au RNE.",
      };
    } else {
      const name = displayName(d);
      if (!name) continue;
      id = `pe:${slugify(name)}`;
      entity = {
        id,
        type: "person",
        label: name,
        evidenceLevel: "declared",
        attributes: qualite ? { Qualité: qualite } : {},
        source: SOURCE_LABEL,
        excerpt: "Dirigeant publié au registre national des entreprises (RNE).",
      };
    }

    if (seen.has(id)) continue;
    seen.add(id);
    entities.push(entity);
    edges.push({
      id: `e:re:${id}:${companyId}:${slugify(qualite || "dirige")}`,
      type: "DIRIGE",
      source: id,
      target: companyId,
      label: qualite || "dirige",
      evidenceLevel: "declared",
      sourceLabel: EDGE_SOURCE,
      excerpt: qualite
        ? `${qualite} publié(e) au RNE (via Recherche d'entreprises).`
        : "Dirigeant publié au RNE (via Recherche d'entreprises).",
    });
  }
  return { entities, edges };
}

const fmtEuro = (n: number, year: number): string =>
  `${n.toLocaleString("fr-FR")} € (${year})`;

/**
 * Attributs à greffer sur le nœud société CANONIQUE : derniers comptes publiés,
 * indicateurs publics, commissaires aux comptes, fraîcheur du RNE. Vide si la
 * consultation n'a rien donné (jamais de valeur inventée).
 */
export function rechercheAttributes(raw: unknown): Record<string, string> {
  const data = asData(raw);
  const attrs: Record<string, string> = {};
  if (data.status !== "ok") return attrs;

  const latest = (Array.isArray(data.finances) ? data.finances : [])
    .slice()
    .sort((a, b) => b.annee - a.annee)[0];
  if (latest) {
    if (latest.ca != null) attrs["CA (dernier exercice)"] = fmtEuro(latest.ca, latest.annee);
    if (latest.resultatNet != null) attrs["Résultat net"] = fmtEuro(latest.resultatNet, latest.annee);
    if (latest.ca != null || latest.resultatNet != null) {
      attrs["Source des comptes"] = "Recherche d'entreprises (DINUM)";
    }
  }

  if (Array.isArray(data.labels) && data.labels.length > 0) {
    attrs["Indicateurs publics"] = data.labels.join(", ");
  }

  const auditors = (Array.isArray(data.dirigeants) ? data.dirigeants : [])
    .filter(isAuditor)
    .map((d) => (d.denomination ?? displayName(d)).trim())
    .filter(Boolean);
  if (auditors.length > 0) {
    const shown = auditors.slice(0, 3).join(" ; ");
    attrs["Commissaires aux comptes"] =
      auditors.length > 3 ? `${shown} (+${auditors.length - 3})` : shown;
  }

  const rne = data.company?.rneUpdatedOn;
  if (rne) attrs["Dirigeants — RNE mis à jour le"] = rne.slice(0, 10);
  return attrs;
}
