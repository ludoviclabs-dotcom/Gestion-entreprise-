import type { CaseBundle } from "@/lib/graph/graph-types";
import { parsePct } from "@/lib/graph/ubo";

/**
 * Indicateurs structurels (compute-first) dérivés du graphe d'un dossier. Purs,
 * déterministes, non accusatoires : chiffres à verser au faisceau, jamais une
 * conclusion. Réutilisent des données DÉJÀ présentes (arêtes/attributs).
 */

/** Opacité capitalistique : part des liens de détention sans % exploitable. */
export type CapitalOpacity = { total: number; missing: number; ratio: number };

export function computeCapitalOpacity(bundle: CaseBundle): CapitalOpacity {
  const detient = bundle.edges.filter((e) => e.type === "DETIENT");
  const missing = detient.filter((e) => parsePct(e.weight) === null).length;
  const total = detient.length;
  return { total, missing, ratio: total > 0 ? missing / total : 0 };
}

/** Exposition transfrontalière : pays étrangers des sociétés (hors France). */
export type CrossBorderExposure = {
  countries: string[];
  count: number;
  hasForeign: boolean;
  hasNonEu: boolean;
};

const EU_EEA = new Set([
  "FR", "DE", "BE", "NL", "LU", "ES", "IT", "PT", "IE", "AT", "FI", "SE",
  "DK", "PL", "CZ", "SK", "SI", "HR", "HU", "RO", "BG", "GR", "EE", "LV",
  "LT", "CY", "MT", "IS", "LI", "NO",
]);

export function computeCrossBorderExposure(bundle: CaseBundle): CrossBorderExposure {
  const countries = new Set<string>();
  let hasNonEu = false;
  for (const e of bundle.entities) {
    if (e.type !== "company") continue;
    const pays = e.attributes?.["Pays"];
    if (!pays) continue;
    const code = pays.trim().toUpperCase();
    if (code === "FRANCE" || code === "FR") continue;
    countries.add(code);
    if (!EU_EEA.has(code)) hasNonEu = true;
  }
  return {
    countries: [...countries].sort(),
    count: countries.size,
    hasForeign: countries.size > 0,
    hasNonEu,
  };
}

/** Concentration de domiciliation : degré entrant max sur un nœud adresse. */
export type DomiciliationConcentration = {
  maxDegree: number;
  addressId: string | null;
  addressLabel: string | null;
};

export function computeDomiciliationConcentration(
  bundle: CaseBundle,
): DomiciliationConcentration {
  const inDegree = new Map<string, number>();
  for (const edge of bundle.edges) {
    if (edge.type !== "PARTAGE_ADRESSE") continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }
  let addressId: string | null = null;
  let maxDegree = 0;
  for (const [id, deg] of inDegree) {
    if (deg > maxDegree) {
      maxDegree = deg;
      addressId = id;
    }
  }
  const addr = addressId
    ? bundle.entities.find((e) => e.id === addressId)
    : undefined;
  return { maxDegree, addressId, addressLabel: addr?.label ?? null };
}

export type StructuralIndicators = {
  opacity: CapitalOpacity;
  crossBorder: CrossBorderExposure;
  domiciliation: DomiciliationConcentration;
};

export function computeStructuralIndicators(
  bundle: CaseBundle,
): StructuralIndicators {
  return {
    opacity: computeCapitalOpacity(bundle),
    crossBorder: computeCrossBorderExposure(bundle),
    domiciliation: computeDomiciliationConcentration(bundle),
  };
}
