import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type { CompaniesHouseRaw, ChOfficer, ChPsc } from "@/lib/connectors/companies-house";
import { slugify } from "@/lib/text";

/**
 * Normalise une réponse Companies House pour UNE société mère britannique déjà
 * présente dans le graphe (nœud GLEIF `co:lei:…`).
 *
 *  - dirigeants EN FONCTION → nœuds person/company + arêtes `DIRIGE` (dates de
 *    nomination conservées) ;
 *  - personnes à contrôle significatif (PSC) EN COURS → arêtes `DETIENT` SANS
 *    pourcentage : le registre publie des TRANCHES (« 25 à 50 % »), jamais une
 *    valeur ; les convertir en % précis fausserait `computeUbo` ;
 *  - PSC personnes physiques : même garde-fou que les bénéficiaires effectifs
 *    INPI (`exposeIndividualPsc`, cf. INPI_EXPOSE_UBO) — par prudence tant que
 *    l'auth + le journal d'intérêt légitime ne sont pas en place ;
 *  - aucune date de naissance, adresse ni nationalité (minimisation).
 *
 * Pur : ne lève jamais (entrée défensive).
 */
export type CompaniesHouseNormalized = {
  entities: CaseEntity[];
  edges: CaseEdge[];
  /** Attributs à greffer sur le nœud de la société mère. */
  companyAttributes: Record<string, string>;
};

const MAX_OFFICERS = 50;

const ROLE_FR: Record<string, string> = {
  director: "Administrateur (director)",
  secretary: "Secrétaire (secretary)",
  "corporate-director": "Administrateur personne morale",
  "corporate-secretary": "Secrétaire personne morale",
  "llp-member": "Membre de LLP",
  "llp-designated-member": "Membre désigné de LLP",
  "corporate-llp-member": "Membre de LLP (personne morale)",
  "corporate-llp-designated-member": "Membre désigné de LLP (personne morale)",
  nominee: "Mandataire (nominee)",
};

const NATURE_FR: [RegExp, string][] = [
  [/^ownership-of-shares-(\d+)-to-(\d+)-percent/, "parts : $1 à $2 %"],
  [/^voting-rights-(\d+)-to-(\d+)-percent/, "droits de vote : $1 à $2 %"],
  [/^right-to-appoint-and-remove-directors/, "nomination / révocation des administrateurs"],
  [/^significant-influence-or-control/, "influence ou contrôle notable"],
  [/^right-to-share-surplus-assets-(\d+)-to-(\d+)-percent/, "excédent d'actifs : $1 à $2 %"],
];

function natureLabel(code: string): string {
  for (const [re, fr] of NATURE_FR) {
    if (re.test(code)) return code.replace(re, fr);
  }
  return code;
}

/** « MURPHY, Ken » → « Ken MURPHY » ; les noms de sociétés sont laissés tels quels. */
export function displayName(name: string, corporate: boolean): string {
  const n = name.trim();
  if (corporate) return n;
  const comma = n.indexOf(",");
  if (comma <= 0) return n;
  const surname = n.slice(0, comma).trim();
  const forenames = n.slice(comma + 1).trim();
  return forenames ? `${forenames} ${surname}` : surname;
}

function holderId(name: string, corporate: boolean, registration?: string | null): string {
  if (corporate) {
    return registration ? `co:gb:${registration}` : `co:${slugify(name)}`;
  }
  return `pe:${slugify(name)}`;
}

export function normalizeCompaniesHouse(
  raw: unknown,
  ctx: { companyId: string; exposeIndividualPsc?: boolean },
): CompaniesHouseNormalized {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<CompaniesHouseRaw>;
  const entities: CaseEntity[] = [];
  const edges: CaseEdge[] = [];
  const seen = new Set<string>();
  const companyAttributes: Record<string, string> = {};

  if (data.status !== "ok" || !data.company) {
    return { entities, edges, companyAttributes };
  }

  const c = data.company;
  companyAttributes["N° Companies House"] = c.number;
  if (c.status) companyAttributes["Statut (Companies House)"] = c.status;
  if (c.type) companyAttributes["Forme (Companies House)"] = c.type;
  if (c.createdOn) companyAttributes["Création (Companies House)"] = c.createdOn;
  if (typeof data.officersActive === "number") {
    companyAttributes["Dirigeants en fonction (Companies House)"] = String(data.officersActive);
  }

  const officers: ChOfficer[] = Array.isArray(data.officers) ? data.officers : [];
  for (const o of officers.slice(0, MAX_OFFICERS)) {
    if (!o?.name || o.resignedOn) continue;
    const label = displayName(o.name, o.corporate);
    const id = holderId(label, o.corporate);
    const role = ROLE_FR[o.role] ?? o.role;
    if (!seen.has(id)) {
      seen.add(id);
      entities.push({
        id,
        type: o.corporate ? "company" : "person",
        label,
        evidenceLevel: "declared",
        attributes: { Qualité: role, ...(o.appointedOn ? { "En fonction depuis": o.appointedOn } : {}) },
        source: "Companies House — dirigeants",
        excerpt: "Dirigeant en fonction déclaré au registre britannique Companies House.",
      });
    }
    edges.push({
      id: `e:ch:${id}:${ctx.companyId}:${slugify(o.role)}`,
      type: "DIRIGE",
      source: id,
      target: ctx.companyId,
      label: role,
      evidenceLevel: "declared",
      sourceLabel: "Companies House",
      excerpt: `${role} en fonction, déclaré à Companies House.`,
      ...(o.appointedOn ? { validFrom: o.appointedOn } : {}),
    });
  }

  const pscs: ChPsc[] = Array.isArray(data.pscs) ? data.pscs : [];
  for (const p of pscs) {
    if (!p?.name || p.ceasedOn) continue;
    if (p.kind.startsWith("super-secure")) continue; // identité volontairement masquée
    if (!p.corporate && !ctx.exposeIndividualPsc) continue; // garde-fou UBO
    const label = displayName(p.name, p.corporate);
    const id = holderId(label, p.corporate, p.registrationNumber);
    const natures = p.natures.map(natureLabel);
    if (!seen.has(id)) {
      seen.add(id);
      entities.push({
        id,
        type: p.corporate ? "company" : "person",
        label,
        evidenceLevel: "declared",
        attributes: {
          "Contrôle significatif": "oui",
          ...(p.registrationNumber ? { "N° Companies House": p.registrationNumber } : {}),
        },
        source: "Companies House — personnes à contrôle significatif",
        excerpt: "Personne à contrôle significatif déclarée à Companies House.",
      });
    }
    edges.push({
      id: `e:ch:psc:${id}:${ctx.companyId}`,
      type: "DETIENT",
      source: id,
      target: ctx.companyId,
      // Tranche déclarée — volontairement SANS `weight` (jamais un % précis).
      label: natures.length > 0 ? natures.slice(0, 3).join(" · ") : "contrôle significatif",
      evidenceLevel: "declared",
      sourceLabel: "Companies House",
      excerpt: "Contrôle significatif déclaré à Companies House (tranche, pas un pourcentage précis).",
      ...(p.notifiedOn ? { validFrom: p.notifiedOn } : {}),
    });
  }

  return { entities, edges, companyAttributes };
}
