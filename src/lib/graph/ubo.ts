import type { CaseBundle } from "./graph-types";
import { slugify } from "@/lib/text";

/**
 * Moteur de résolution du bénéficiaire effectif (UBO).
 *
 * Pur (aucune dépendance à `env` ni à graphology) : remonte le sous-graphe de
 * détention dirigé (`DETIENT`, convention `source détient target`) depuis la
 * société sujet vers les personnes, multiplie les pourcentages le long de
 * chaque chemin et somme les chemins parallèles → détention effective. Calcule
 * aussi le contrôle majoritaire (≥ 50 % à chaque étage) qui vaut contrôle même
 * si le produit tombe sous 25 % (subtilité AMLR). Cycle-safe.
 *
 * Le seuil de 25 % correspond au seuil de bénéficiaire effectif harmonisé par
 * le Règlement (UE) 2024/1624 (AMLR) et les directives LCB-FT.
 */

export const UBO_THRESHOLD = 0.25;
const CONTROL_THRESHOLD = 0.5;

export type ComputedUbo = {
  personId: string;
  label: string;
  /** Détention effective cumulée (0..1), somme des produits sur tous les chemins. */
  effectivePct: number;
  /** Contrôle via au moins un chemin entièrement majoritaire (≥ 50 % à chaque étage). */
  hasControl: boolean;
  /** ≥ 25 % de détention effective OU contrôle majoritaire. */
  isBeneficialOwner: boolean;
  /** Nombre de chemins de détention distincts menant à cette personne. */
  pathsCount: number;
};

/** Parse un poids d'arête (« 60 % », « 60% », « 60 », « 12,5 % ») → fraction 0..1, ou null. */
export function parsePct(weight?: string | null): number | null {
  if (!weight) return null;
  const cleaned = weight.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value / 100;
}

type OwnerLink = { ownerId: string; pct: number };

/** Identifie la société sujet du dossier (racine de la remontée UBO). */
function findRootCompany(bundle: CaseBundle): string | null {
  const companies = bundle.entities.filter((e) => e.type === "company");
  if (companies.length === 0) return null;
  // 1) société portant le SIREN racine (comparaison en chiffres seuls : les
  //    attributs sont souvent formatés « 812 345 678 » vs rootSiren brut).
  const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
  const rootDigits = digits(bundle.case.rootSiren);
  if (rootDigits) {
    const bySiren = companies.find(
      (c) => digits(c.attributes?.SIREN) === rootDigits,
    );
    if (bySiren) return bySiren.id;
  }
  // 2) société la plus « détenue » (plus d'arêtes DETIENT entrantes).
  const inDegree = new Map<string, number>();
  for (const edge of bundle.edges) {
    if (edge.type !== "DETIENT") continue;
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestDeg = -1;
  for (const c of companies) {
    const d = inDegree.get(c.id) ?? 0;
    if (d > bestDeg) {
      bestDeg = d;
      best = c.id;
    }
  }
  // 3) fallback : première société.
  return best ?? companies[0].id;
}

/**
 * Résout les bénéficiaires effectifs de la société sujet du `bundle`.
 * Renvoie la liste des personnes avec leur détention effective et leur statut.
 */
export function computeUbo(bundle: CaseBundle, rootId?: string): ComputedUbo[] {
  const root = rootId ?? findRootCompany(bundle);
  if (!root) return [];

  const entityById = new Map(bundle.entities.map((e) => [e.id, e]));

  // Adjacence inversée : pour un nœud détenu → ses détenteurs directs (+ %).
  const owners = new Map<string, OwnerLink[]>();
  for (const edge of bundle.edges) {
    if (edge.type !== "DETIENT") continue;
    const pct = parsePct(edge.weight);
    if (pct === null) continue; // arête sans % exploitable → ignorée du calcul effectif.
    const list = owners.get(edge.target) ?? [];
    list.push({ ownerId: edge.source, pct });
    owners.set(edge.target, list);
  }

  // Accumulateur par personne.
  const acc = new Map<
    string,
    { effectivePct: number; hasControl: boolean; pathsCount: number }
  >();

  const visited = new Set<string>([root]);

  function walk(nodeId: string, product: number, allMajority: boolean): void {
    for (const { ownerId, pct } of owners.get(nodeId) ?? []) {
      if (visited.has(ownerId)) continue; // garde anti-cycle (par chemin).
      const newProduct = product * pct;
      const newMajority = allMajority && pct >= CONTROL_THRESHOLD;
      const owner = entityById.get(ownerId);
      if (!owner) continue;

      if (owner.type === "person") {
        const cur = acc.get(ownerId) ?? {
          effectivePct: 0,
          hasControl: false,
          pathsCount: 0,
        };
        cur.effectivePct += newProduct;
        cur.hasControl = cur.hasControl || newMajority;
        cur.pathsCount += 1;
        acc.set(ownerId, cur);
      } else if (owner.type === "company") {
        visited.add(ownerId);
        walk(ownerId, newProduct, newMajority);
        visited.delete(ownerId);
      }
    }
  }

  walk(root, 1, true);

  const result: ComputedUbo[] = [];
  for (const [personId, v] of acc) {
    const effectivePct = Math.min(1, v.effectivePct);
    result.push({
      personId,
      label: entityById.get(personId)?.label ?? personId,
      effectivePct,
      hasControl: v.hasControl,
      isBeneficialOwner: effectivePct >= UBO_THRESHOLD || v.hasControl,
      pathsCount: v.pathsCount,
    });
  }
  // Tri décroissant par détention effective (les UBO majeurs en tête).
  result.sort((a, b) => b.effectivePct - a.effectivePct);
  return result;
}

/** Résultat agrégé (jamais nominatif) de la comparaison déclaré / recalculé. */
export type UboComparison = {
  declares: number;
  recalcules: number;
  divergences: number;
};

/**
 * Compare les bénéficiaires effectifs DÉCLARÉS au registre
 * (`bundle.declaredUbo`) avec ceux RECALCULÉS depuis le capital
 * (`computeUbo`). Renvoie des COMPTES uniquement (CJUE 2022) — utilisé par la
 * règle ECART_UBO_DECLARE et par le journal de preuve (`ecart_ubo_detecte`).
 * `null` si aucune liste déclarée n'est disponible.
 */
export function compareDeclaredUbo(bundle: CaseBundle): UboComparison | null {
  const declared = bundle.declaredUbo ?? [];
  if (declared.length === 0) return null;

  const nameKey = (s: string) => slugify(s);
  const declaredKeys = new Set(
    declared.map((d) =>
      nameKey(d.label || [d.prenoms, d.nom].filter(Boolean).join(" ")),
    ),
  );
  const computedOwners = computeUbo(bundle).filter((u) => u.isBeneficialOwner);
  const computedKeys = new Set(computedOwners.map((u) => nameKey(u.label)));

  let divergences = 0;
  for (const key of declaredKeys) if (!computedKeys.has(key)) divergences += 1;
  for (const key of computedKeys) if (!declaredKeys.has(key)) divergences += 1;

  return {
    declares: declared.length,
    recalcules: computedOwners.length,
    divergences,
  };
}
