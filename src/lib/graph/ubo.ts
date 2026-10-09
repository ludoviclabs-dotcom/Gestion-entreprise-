import type { CaseBundle, CaseEdge } from "./graph-types";
import { isHypothesis } from "./graph-types";
import { slugify } from "@/lib/text";

/**
 * Moteur de résolution du bénéficiaire effectif (UBO).
 *
 * Pur (aucune dépendance à `env` ni à graphology) : remonte le sous-graphe de
 * détention dirigé (`DETIENT`, convention `source détient target`) depuis la
 * société sujet vers les personnes, multiplie les pourcentages le long de
 * chaque chemin et somme les chemins parallèles. Cycle-safe.
 *
 * Trois résultats distincts, jamais confondus :
 *   1. la détention économique calculée (capital) et les droits de vote ;
 *   2. le contrôle documenté (majorité stricte des votes à chaque étage, ou
 *      présomption de l'art. L. 233-3 II C. com., à confirmer) ;
 *   3. la qualification selon un référentiel DATÉ (`UboPolicy`) : le droit
 *      français actuel (« plus de 25 % », art. R. 561-1 CMF) et l'AMLR à partir
 *      du 10 juillet 2027 (« 25 % ou plus »).
 *
 * Le moteur renvoie aussi ses limites (pourcentages absents, cycles, capital
 * incomplet, liens hypothétiques…) : une chaîne incomplète ne produit jamais
 * une certitude artificielle.
 */

// ── Référentiels datés ────────────────────────────────────────────────────

export type UboPolicyId = "FR_CMF_R561_1" | "EU_AMLR_2024_1624";

export type UboPolicy = {
  id: UboPolicyId;
  label: string;
  /** Référence courte affichée à côté du seuil. */
  shortLabel: string;
  reference: string;
  url: string;
  /** Bornes d'application (ISO date, incluses). */
  appliesFrom?: string;
  appliesUntil?: string;
  threshold: number;
  /** true : « 25 % ou plus » ; false : « plus de 25 % ». */
  inclusive: boolean;
  thresholdLabel: string;
};

export const UBO_POLICIES: Record<UboPolicyId, UboPolicy> = {
  FR_CMF_R561_1: {
    id: "FR_CMF_R561_1",
    label: "Droit français — Code monétaire et financier",
    shortLabel: "CMF R. 561-1",
    reference:
      "Code monétaire et financier, art. R. 561-1 : personne physique détenant plus de 25 % du capital ou des droits de vote, ou exerçant un contrôle par un autre moyen (art. L. 233-3 I 3° et 4° C. com.).",
    url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036824564",
    appliesUntil: "2027-07-09",
    threshold: 0.25,
    inclusive: false,
    thresholdLabel: "plus de 25 %",
  },
  EU_AMLR_2024_1624: {
    id: "EU_AMLR_2024_1624",
    label: "Règlement (UE) 2024/1624 (AMLR)",
    shortLabel: "AMLR 2024/1624",
    reference:
      "Règlement (UE) 2024/1624, art. 51 et suivants : participation de 25 % ou plus du capital, des droits de vote ou d'une autre participation, ou contrôle par d'autres moyens. Application principale au 10 juillet 2027 (art. 90).",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32024R1624",
    appliesFrom: "2027-07-10",
    threshold: 0.25,
    inclusive: true,
    thresholdLabel: "25 % ou plus",
  },
};

/** Seuil nominal (25 %) — conservé pour les visualisations. */
export const UBO_THRESHOLD = 0.25;
/** Majorité des droits de vote : STRICTEMENT plus de la moitié (50 % n'est pas une majorité). */
const MAJORITY = 0.5;
/** Présomption de contrôle (art. L. 233-3 II C. com.) : plus de 40 % des votes, aucun autre détenteur au-dessus. */
const PRESUMPTION = 0.4;
/** Tolérance d'arrondi des produits flottants (0,5 × 0,5 doit valoir 25 %). */
const EPS = 1e-9;

/** Référentiel applicable à une date ISO (AAAA-MM-JJ). */
export function uboPolicyFor(asOf: string): UboPolicy {
  const amlr = UBO_POLICIES.EU_AMLR_2024_1624;
  return asOf >= (amlr.appliesFrom ?? "") ? amlr : UBO_POLICIES.FR_CMF_R561_1;
}

/** La fraction atteint-elle le seuil du référentiel (strict ou inclusif) ? */
export function meetsThreshold(fraction: number, policy: UboPolicy): boolean {
  return policy.inclusive
    ? fraction >= policy.threshold - EPS
    : fraction > policy.threshold + EPS;
}

// ── Types de résultat ─────────────────────────────────────────────────────

export type UboControl = "majorite" | "presomption" | "aucun";
export type UboQualification = "beneficiaire" | "a_examiner" | "sous_le_seuil";

export type ComputedUbo = {
  personId: string;
  label: string;
  /** Détention de capital cumulée (0..1), tous liens inclus (y compris hypothétiques). */
  effectivePct: number;
  /** Droits de vote cumulés (0..1), tous liens inclus. */
  effectiveVotingPct: number;
  /** Détention de capital établie sur les seuls liens confirmés ou déclarés. */
  documentedPct: number;
  /** Droits de vote établis sur les seuls liens confirmés ou déclarés. */
  documentedVotingPct: number;
  /** Meilleur contrôle établi sur des liens documentés. */
  control: UboControl;
  /** Contrôle majoritaire documenté à chaque étage (raccourci d'affichage). */
  hasControl: boolean;
  qualification: UboQualification;
  /** `qualification === "beneficiaire"`. */
  isBeneficialOwner: boolean;
  /** Pourquoi cette qualification (phrases courtes, affichables). */
  reasons: string[];
  /** Nombre de chemins de détention distincts menant à cette personne. */
  pathsCount: number;
  /** Au moins un étage sans droits de vote documentés (supposés = capital). */
  votesAssumed: boolean;
  /** Droits particuliers documentés sur la chaîne (pacte, veto, nomination…). */
  specialRights: string[];
};

export type UboLimitKind =
  | "pourcentage_absent"
  | "cycle"
  | "total_incoherent"
  | "capital_incomplet"
  | "votes_supposes"
  | "lien_hypothetique"
  | "hors_periode"
  | "autres_moyens";

export type UboLimit = {
  kind: UboLimitKind;
  message: string;
  /** Liens ou entités concernés. */
  subjectIds: string[];
};

export type UboAnalysis = {
  rootId: string | null;
  /** Date d'analyse : relations filtrées sur leur validité à cette date. */
  asOf?: string;
  policy: UboPolicy;
  owners: ComputedUbo[];
  limits: UboLimit[];
};

/** Parse un poids d'arête (« 60 % », « 60% », « 60 », « 12,5 % ») → fraction 0..1, ou null. */
export function parsePct(weight?: string | null): number | null {
  if (!weight) return null;
  const cleaned = weight.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value / 100;
}

/** Une relation est-elle en vigueur à la date `asOf` (bornes incluses) ? */
export function isValidAt(edge: Pick<CaseEdge, "validFrom" | "validTo">, asOf: string): boolean {
  if (edge.validFrom && edge.validFrom.slice(0, 10) > asOf) return false;
  if (edge.validTo && edge.validTo.slice(0, 10) < asOf) return false;
  return true;
}

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

type OwnerLink = {
  edgeId: string;
  ownerId: string;
  capital: number;
  votes: number;
  votesAssumed: boolean;
  hypothetical: boolean;
  specialRights?: string;
};

const CONTROL_RANK: Record<UboControl, number> = {
  aucun: 0,
  presomption: 1,
  majorite: 2,
};

/** Contrôle d'une chaîne : l'étage le plus faible l'emporte. */
function combineControl(a: UboControl, b: UboControl): UboControl {
  return CONTROL_RANK[a] <= CONTROL_RANK[b] ? a : b;
}

function bestControl(a: UboControl, b: UboControl): UboControl {
  return CONTROL_RANK[a] >= CONTROL_RANK[b] ? a : b;
}

/** Contrôle exercé par un détenteur direct sur la société détenue, à cet étage. */
function tierControl(link: OwnerLink, siblings: OwnerLink[]): UboControl {
  if (link.votes > MAJORITY + EPS) return "majorite";
  if (
    link.votes > PRESUMPTION + EPS &&
    siblings.every((s) => s === link || s.votes <= link.votes + EPS)
  ) {
    return "presomption";
  }
  return "aucun";
}

export function fmtFraction(fraction: number): string {
  // Tronque à un décimal SANS arrondir au-dessus (24,99 % → 24,9 %, pas 25,0 %).
  return `${(Math.floor(fraction * 1000 + EPS) / 10).toLocaleString("fr-FR")} %`;
}

/**
 * Analyse complète : bénéficiaires effectifs, référentiel appliqué et limites.
 * `asOf` (AAAA-MM-JJ) filtre les relations sur leur validité et choisit le
 * référentiel ; sans `asOf`, toutes les relations sont prises en compte et le
 * référentiel est celui du jour.
 */
export function analyzeUbo(
  bundle: CaseBundle,
  opts: { rootId?: string; asOf?: string; policy?: UboPolicy } = {},
): UboAnalysis {
  const asOf = opts.asOf?.slice(0, 10);
  const policy =
    opts.policy ?? uboPolicyFor(asOf ?? new Date().toISOString().slice(0, 10));
  const root = opts.rootId ?? findRootCompany(bundle);
  const limits: UboLimit[] = [];
  if (!root) return { rootId: null, asOf, policy, owners: [], limits };

  const entityById = new Map(bundle.entities.map((e) => [e.id, e]));
  const labelOf = (id: string) => entityById.get(id)?.label ?? id;

  // Adjacence inversée : pour un nœud détenu → ses détenteurs directs.
  const owners = new Map<string, OwnerLink[]>();
  const missingPct: string[] = [];
  const outOfPeriod: string[] = [];
  for (const edge of bundle.edges) {
    if (edge.type !== "DETIENT") continue;
    if (asOf && !isValidAt(edge, asOf)) {
      outOfPeriod.push(edge.id);
      continue;
    }
    const capital = parsePct(edge.weight);
    const explicitVotes = parsePct(edge.votingWeight);
    if (capital === null && explicitVotes === null) {
      missingPct.push(edge.id);
      continue;
    }
    const list = owners.get(edge.target) ?? [];
    list.push({
      edgeId: edge.id,
      ownerId: edge.source,
      capital: capital ?? 0,
      votes: explicitVotes ?? capital ?? 0,
      votesAssumed: explicitVotes === null,
      hypothetical: isHypothesis(edge.evidenceLevel),
      specialRights: edge.specialRights?.trim() || undefined,
    });
    owners.set(edge.target, list);
  }

  type Acc = {
    cap: number;
    votes: number;
    docCap: number;
    docVotes: number;
    /** Votes documentés à chaque étage : aucun n'est supposé égal au capital. */
    explicitVotes: number;
    docControl: UboControl;
    anyControl: UboControl;
    paths: number;
    votesAssumed: boolean;
    rights: Set<string>;
  };
  const acc = new Map<string, Acc>();

  const visited = new Set<string>([root]);
  const walkedCompanies = new Set<string>();
  const walkedEdges = new Set<string>();
  const cycleEdges = new Set<string>();

  function walk(
    nodeId: string,
    cap: number,
    votes: number,
    control: UboControl,
    hypothetical: boolean,
    votesAssumed: boolean,
    rights: string[],
  ): void {
    walkedCompanies.add(nodeId);
    const siblings = owners.get(nodeId) ?? [];
    for (const link of siblings) {
      const owner = entityById.get(link.ownerId);
      if (!owner) continue;
      if (visited.has(link.ownerId)) {
        cycleEdges.add(link.edgeId); // garde anti-cycle (par chemin).
        continue;
      }
      walkedEdges.add(link.edgeId);
      const nCap = cap * link.capital;
      const nVotes = votes * link.votes;
      const nControl = combineControl(control, tierControl(link, siblings));
      const nHyp = hypothetical || link.hypothetical;
      const nAssumed = votesAssumed || link.votesAssumed;
      const nRights = link.specialRights ? [...rights, link.specialRights] : rights;

      if (owner.type === "person") {
        const cur: Acc = acc.get(link.ownerId) ?? {
          cap: 0,
          votes: 0,
          docCap: 0,
          docVotes: 0,
          explicitVotes: 0,
          docControl: "aucun",
          anyControl: "aucun",
          paths: 0,
          votesAssumed: false,
          rights: new Set(),
        };
        cur.cap += nCap;
        cur.votes += nVotes;
        if (!nHyp) {
          cur.docCap += nCap;
          cur.docVotes += nVotes;
          if (!nAssumed) cur.explicitVotes += nVotes;
          cur.docControl = bestControl(cur.docControl, nControl);
        }
        cur.anyControl = bestControl(cur.anyControl, nControl);
        cur.paths += 1;
        cur.votesAssumed = cur.votesAssumed || nAssumed;
        for (const r of nRights) cur.rights.add(r);
        acc.set(link.ownerId, cur);
      } else if (owner.type === "company") {
        visited.add(link.ownerId);
        walk(link.ownerId, nCap, nVotes, nControl, nHyp, nAssumed, nRights);
        visited.delete(link.ownerId);
      }
    }
  }

  walk(root, 1, 1, "majorite", false, false, []);

  // ── Qualification par personne ──
  const result: ComputedUbo[] = [];
  for (const [personId, v] of acc) {
    const reasons: string[] = [];
    const docCapOk = meetsThreshold(v.docCap, policy);
    // Un seuil de votes qui n'est atteint qu'en supposant les votes égaux au capital
    // sur un étage ne qualifie pas : il se signale, à examiner.
    const docVotesOk = meetsThreshold(v.explicitVotes, policy);
    const assumedVotesOk = !docVotesOk && meetsThreshold(v.docVotes, policy);
    const anyCapOk = meetsThreshold(v.cap, policy);
    const anyVotesOk = meetsThreshold(v.votes, policy);

    let qualification: UboQualification = "sous_le_seuil";
    if (docCapOk || docVotesOk || v.docControl === "majorite") {
      qualification = "beneficiaire";
      if (docCapOk) {
        reasons.push(`${fmtFraction(v.docCap)} du capital (${policy.thresholdLabel} requis)`);
      }
      if (docVotesOk && (!docCapOk || v.votesAssumed === false)) {
        reasons.push(`${fmtFraction(v.docVotes)} des droits de vote`);
      }
      if (v.docControl === "majorite") {
        reasons.push("Majorité des droits de vote à chaque étage de la chaîne");
      }
    } else {
      if (assumedVotesOk) {
        reasons.push(
          `Seuil des droits de vote atteint (${fmtFraction(v.docVotes)}) seulement en supposant les votes égaux au capital sur un étage`,
        );
      } else if (anyCapOk || anyVotesOk) {
        reasons.push(
          `Seuil atteint (${fmtFraction(Math.max(v.cap, v.votes))}) seulement en comptant un lien inféré ou simulé`,
        );
      }
      if (v.anyControl === "majorite") {
        reasons.push("Contrôle majoritaire qui repose sur un lien inféré ou simulé");
      }
      if (v.docControl === "presomption" || v.anyControl === "presomption") {
        reasons.push(
          "Présomption de contrôle : plus de 40 % des votes sans détenteur supérieur (L. 233-3 II C. com.), à confirmer",
        );
      }
      if (v.rights.size > 0) {
        reasons.push(`Droits particuliers documentés : ${[...v.rights].join(" ; ")}`);
      }
      if (reasons.length > 0) qualification = "a_examiner";
    }

    result.push({
      personId,
      label: labelOf(personId),
      effectivePct: Math.min(1, v.cap),
      effectiveVotingPct: Math.min(1, v.votes),
      documentedPct: Math.min(1, v.docCap),
      documentedVotingPct: Math.min(1, v.docVotes),
      control: v.docControl,
      hasControl: v.docControl === "majorite",
      qualification,
      isBeneficialOwner: qualification === "beneficiaire",
      reasons,
      pathsCount: v.paths,
      votesAssumed: v.votesAssumed,
      specialRights: [...v.rights],
    });
  }
  // Tri décroissant par détention effective (les UBO majeurs en tête).
  result.sort((a, b) => b.effectivePct - a.effectivePct);

  // ── Limites du calcul ──
  if (outOfPeriod.length > 0) {
    limits.push({
      kind: "hors_periode",
      message: `${outOfPeriod.length} lien(s) de détention hors de leur période de validité au ${asOf} : écartés du calcul.`,
      subjectIds: outOfPeriod,
    });
  }
  if (missingPct.length > 0) {
    limits.push({
      kind: "pourcentage_absent",
      message: `${missingPct.length} lien(s) de détention sans pourcentage exploitable : ignorés du calcul, la détention réelle peut être supérieure.`,
      subjectIds: missingPct,
    });
  }
  if (cycleEdges.size > 0) {
    limits.push({
      kind: "cycle",
      message:
        "Participation circulaire détectée : le calcul s'arrête sur la boucle. Une revue manuelle est nécessaire.",
      subjectIds: [...cycleEdges],
    });
  }
  for (const companyId of walkedCompanies) {
    const total = (owners.get(companyId) ?? []).reduce((s, l) => s + l.capital, 0);
    if (total > 1 + 0.005) {
      limits.push({
        kind: "total_incoherent",
        message: `Les participations documentées dans ${labelOf(companyId)} totalisent ${fmtFraction(total)} : données incohérentes à corriger.`,
        subjectIds: [companyId],
      });
    } else if (total < 1 - 0.005) {
      limits.push({
        kind: "capital_incomplet",
        message: `Capital de ${labelOf(companyId)} documenté à ${fmtFraction(total)} : des détenteurs peuvent manquer.`,
        subjectIds: [companyId],
      });
    }
  }
  const walked = [...walkedEdges].flatMap((id) => {
    for (const list of owners.values()) {
      const l = list.find((x) => x.edgeId === id);
      if (l) return [l];
    }
    return [];
  });
  const assumed = walked.filter((l) => l.votesAssumed).map((l) => l.edgeId);
  if (assumed.length > 0) {
    limits.push({
      kind: "votes_supposes",
      message: `Droits de vote supposés proportionnels au capital sur ${assumed.length} lien(s), faute de pièce les décrivant.`,
      subjectIds: assumed,
    });
  }
  const hypothetical = walked.filter((l) => l.hypothetical).map((l) => l.edgeId);
  if (hypothetical.length > 0) {
    limits.push({
      kind: "lien_hypothetique",
      message: `${hypothetical.length} lien(s) inféré(s) ou simulé(s) : ils orientent l'analyse mais ne suffisent pas à qualifier un bénéficiaire effectif.`,
      subjectIds: hypothetical,
    });
  }
  limits.push({
    kind: "autres_moyens",
    message:
      "Le contrôle par d'autres moyens (pacte d'associés, droits de nomination, accords de vote) ne se déduit pas du seul graphe de détention.",
    subjectIds: [],
  });

  return { rootId: root, asOf, policy, owners: result, limits };
}

/**
 * Résout les bénéficiaires effectifs de la société sujet du `bundle`.
 * Raccourci de `analyzeUbo` qui ne renvoie que les personnes.
 */
export function computeUbo(bundle: CaseBundle, rootId?: string): ComputedUbo[] {
  return analyzeUbo(bundle, { rootId }).owners;
}

/** Résultat agrégé (jamais nominatif) de la comparaison déclaré / recalculé. */
export type UboComparison = {
  declares: number;
  recalcules: number;
  divergences: number;
};

/**
 * Compare les bénéficiaires effectifs DÉCLARÉS au registre
 * (`bundle.declaredUbo`) avec les candidats RECALCULÉS depuis le capital
 * (bénéficiaires et personnes à examiner). Renvoie des COMPTES uniquement
 * (CJUE 2022) — utilisé par la règle ECART_UBO_DECLARE et par le journal de
 * preuve (`ecart_ubo_detecte`). `null` si aucune liste déclarée n'est disponible.
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
  const computedOwners = computeUbo(bundle).filter(
    (u) => u.qualification !== "sous_le_seuil",
  );
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
