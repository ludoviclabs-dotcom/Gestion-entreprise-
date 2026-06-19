import type {
  CaseEntity,
  CaseEdge,
  NodeKind,
  EvidenceLevel,
} from "@/lib/graph/graph-types";
import { normalizeName, stripLegalForms } from "@/lib/match/normalize";
import {
  denominationSimilarity,
  jaroWinkler,
} from "@/lib/match/similarity";
import { phoneticKey } from "@/lib/match/phonetic";

/**
 * Résolution d'entités v1 — pur TS, in-process. Fusionne les entités issues de
 * plusieurs sources (sociétés par SIREN puis dénomination floue ; personnes par
 * nom complet flou, gardé par compatibilité de date de naissance), re-pointe les
 * arêtes vers les identifiants canoniques, et trace la provenance des fusions.
 *
 * Garde-fou : deux sociétés portant des SIREN DIFFÉRENTS ne sont jamais
 * fusionnées (entités juridiques distinctes), même à dénomination proche.
 *
 * Le blocking par clé phonétique du « token discriminant » (nom de famille pour
 * une personne, premier token significatif pour une société) reste recall-safe
 * pour les initiales (« Jean Martin » ≈ « J. Martin » partagent la clé du nom).
 */

export type MergeMember = { id: string; label: string; score: number };
export type MergeRecord = {
  canonicalId: string;
  type: NodeKind;
  members: MergeMember[];
  averageScore: number;
};

export type ResolveInput = { entities: CaseEntity[]; edges: CaseEdge[] };
export type ResolveResult = {
  entities: CaseEntity[];
  edges: CaseEdge[];
  merges: MergeRecord[];
  idMap: Record<string, string>;
};
export type ResolveOptions = {
  companyThreshold?: number;
  personThreshold?: number;
};

const DEFAULTS: Required<ResolveOptions> = {
  companyThreshold: 0.9,
  personThreshold: 0.92,
};

const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  confirmed: 3,
  declared: 2,
  inferred: 1,
  simulated: 0,
};
const strongerLevel = (a: EvidenceLevel, b: EvidenceLevel): EvidenceLevel =>
  EVIDENCE_RANK[a] >= EVIDENCE_RANK[b] ? a : b;

// ── Helpers entités ──────────────────────────────────────────────────────

function sirenOf(e: CaseEntity): string | undefined {
  const s = e.attributes?.["SIREN"]?.replace(/\s+/g, "");
  return s && /^\d{9}$/.test(s) ? s : undefined;
}

function birthYearOf(e: CaseEntity): number | undefined {
  const raw =
    e.attributes?.["Naissance"] ??
    e.attributes?.["Date de naissance"] ??
    e.attributes?.["Année de naissance"];
  const m = raw ? /(\d{4})/.exec(raw) : null;
  return m ? Number(m[1]) : undefined;
}

/** Similarité de personnes : alignement de tokens, initiales gérées. */
export function personSimilarity(aLabel: string, bLabel: string): number {
  const A = normalizeName(aLabel).split(" ").filter(Boolean);
  const B = normalizeName(bLabel).split(" ").filter(Boolean);
  if (A.length === 0 || B.length === 0) return 0;
  const tokenSim = (x: string, y: string): number => {
    if (x === y) return 1;
    // Initiale : « j » vs « jean ».
    if ((x.length === 1 && y.startsWith(x)) || (y.length === 1 && x.startsWith(y)))
      return 0.95;
    // Deux prénoms pleins dont l'un est strictement préfixe de l'autre
    // (« jean »/« jeanne », « marc »/« marco ») : noms distincts → faible.
    if (x.length > 1 && y.length > 1 && (x.startsWith(y) || y.startsWith(x)))
      return 0.5;
    return jaroWinkler(x, y);
  };
  const best = (src: string[], dst: string[]): number =>
    src.reduce((acc, t) => acc + Math.max(...dst.map((u) => tokenSim(t, u))), 0) /
    src.length;
  // Min (et non moyenne) : le nom le plus long impose ses tokens non appariés,
  // donc un sous-ensemble (« Marie Dupont » ⊂ « Marie Claire Dupont ») ne suffit
  // pas à fusionner — précision privilégiée à la couverture (contexte KYB).
  return Math.min(best(A, B), best(B, A));
}

// ── Union-Find ───────────────────────────────────────────────────────────

class DSU {
  private parent = new Map<string, string>();
  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined || p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// ── Collapse des doublons exacts (même id) ───────────────────────────────

function collapseById(entities: CaseEntity[]): CaseEntity[] {
  const byId = new Map<string, CaseEntity>();
  for (const e of entities) {
    const existing = byId.get(e.id);
    if (!existing) {
      byId.set(e.id, { ...e, attributes: { ...(e.attributes ?? {}) } });
      continue;
    }
    existing.evidenceLevel = strongerLevel(existing.evidenceLevel, e.evidenceLevel);
    existing.attributes = { ...(e.attributes ?? {}), ...existing.attributes };
    if (!existing.source && e.source) existing.source = e.source;
    if (!existing.excerpt && e.excerpt) existing.excerpt = e.excerpt;
  }
  return [...byId.values()];
}

// ── Choix de l'entité canonique d'un groupe ──────────────────────────────

function pickCanonicalCompany(members: CaseEntity[]): CaseEntity {
  const withSiren = members.filter((m) => sirenOf(m));
  const pool = withSiren.length > 0 ? withSiren : members;
  return [...pool].sort((a, b) => a.id.localeCompare(b.id))[0];
}

function completeness(e: CaseEntity): number {
  const tokens = normalizeName(e.label).split(" ").filter(Boolean);
  const fullTokens = tokens.filter((t) => t.length > 1).length;
  return fullTokens * 1000 + tokens.length * 10 + e.label.length;
}
function pickCanonicalPerson(members: CaseEntity[]): CaseEntity {
  return [...members].sort(
    (a, b) => completeness(b) - completeness(a) || a.id.localeCompare(b.id),
  )[0];
}

// ── Résolution ───────────────────────────────────────────────────────────

export function resolveEntities(
  input: ResolveInput,
  options: ResolveOptions = {},
): ResolveResult {
  const opts = { ...DEFAULTS, ...options };
  const entities = collapseById(input.entities);
  const dsu = new DSU();

  // 1. Sociétés — union par SIREN exact, puis dénomination floue (blocking par
  //    clé phonétique de la dénomination ÉPURÉE des formes juridiques).
  //    Garde-fou transitif : un groupe ne peut jamais contenir deux SIREN
  //    distincts, même via une société sans SIREN servant de pont.
  const companies = entities.filter((e) => e.type === "company");
  const rootSiren = new Map<string, string>();
  for (const c of companies) {
    const s = sirenOf(c);
    if (s) rootSiren.set(c.id, s);
  }
  const tryUnionCompany = (aId: string, bId: string): void => {
    const ra = dsu.find(aId);
    const rb = dsu.find(bId);
    if (ra === rb) return;
    const sa = rootSiren.get(ra);
    const sb = rootSiren.get(rb);
    if (sa && sb && sa !== sb) return; // jamais fusionner deux SIREN distincts
    dsu.union(aId, bId);
    const merged = sa ?? sb;
    if (merged) rootSiren.set(dsu.find(aId), merged);
  };

  const bySiren = new Map<string, string[]>();
  for (const c of companies) {
    const s = sirenOf(c);
    if (!s) continue;
    const list = bySiren.get(s) ?? [];
    list.push(c.id);
    bySiren.set(s, list);
  }
  for (const ids of bySiren.values()) {
    for (let i = 1; i < ids.length; i += 1) tryUnionCompany(ids[0], ids[i]);
  }
  groupByBlock(companies, (c) => phoneticKey(stripLegalForms(c.label))).forEach(
    (bucket) => {
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const a = bucket[i];
          const b = bucket[j];
          if (dsu.find(a.id) === dsu.find(b.id)) continue;
          if (denominationSimilarity(a.label, b.label) >= opts.companyThreshold)
            tryUnionCompany(a.id, b.id);
        }
      }
    },
  );

  // 2. Personnes — nom complet flou (blocking par clé phonétique du nom de
  //    famille = dernier token). Garde-fou naissance TRANSITIF par racine DSU
  //    (miroir de rootSiren) : un groupe ne contient jamais deux années de
  //    naissance pleines distinctes, même via un membre sans naissance.
  const persons = entities.filter((e) => e.type === "person");
  const rootBirth = new Map<string, number>();
  for (const p of persons) {
    const y = birthYearOf(p);
    if (y !== undefined) rootBirth.set(p.id, y);
  }
  const tryUnionPerson = (aId: string, bId: string): void => {
    const ra = dsu.find(aId);
    const rb = dsu.find(bId);
    if (ra === rb) return;
    const ya = rootBirth.get(ra);
    const yb = rootBirth.get(rb);
    if (ya !== undefined && yb !== undefined && ya !== yb) return;
    dsu.union(aId, bId);
    const merged = ya ?? yb;
    if (merged !== undefined) rootBirth.set(dsu.find(aId), merged);
  };
  // Comparaison PAIRE-À-PAIRE complète (pas de blocking) : les personnes d'un
  // dossier sont peu nombreuses (dirigeants/UBO), et personSimilarity est
  // insensible à l'ordre des tokens — ainsi « Jean Martin » et « Martin Jean »
  // (conventions nom/prénom inversées) sont bien comparés.
  for (let i = 0; i < persons.length; i += 1) {
    for (let j = i + 1; j < persons.length; j += 1) {
      const a = persons[i];
      const b = persons[j];
      if (dsu.find(a.id) === dsu.find(b.id)) continue;
      if (personSimilarity(a.label, b.label) >= opts.personThreshold)
        tryUnionPerson(a.id, b.id);
    }
  }

  // 3. Constituer les groupes par racine DSU.
  const groups = new Map<string, CaseEntity[]>();
  for (const e of entities) {
    const root = dsu.find(e.id);
    const list = groups.get(root) ?? [];
    list.push(e);
    groups.set(root, list);
  }

  // 4. Entité canonique + idMap + provenance.
  const idMap: Record<string, string> = {};
  const resolvedEntities: CaseEntity[] = [];
  const merges: MergeRecord[] = [];

  for (const members of groups.values()) {
    const canonical =
      members[0].type === "company"
        ? pickCanonicalCompany(members)
        : members[0].type === "person"
          ? pickCanonicalPerson(members)
          : [...members].sort((a, b) => a.id.localeCompare(b.id))[0];

    const attributes: Record<string, string> = {};
    let level = canonical.evidenceLevel;
    for (const m of members) {
      Object.assign(attributes, m.attributes ?? {});
      level = strongerLevel(level, m.evidenceLevel);
    }
    // Les valeurs de l'entité canonique priment en cas de conflit.
    Object.assign(attributes, canonical.attributes ?? {});

    for (const m of members) idMap[m.id] = canonical.id;

    // Provenance CUMULATIVE : union des membres historiques (portés par le
    // __mergedFrom de chaque membre, ex. re-résolution après ajout de document)
    // avec les nouveaux, dédupliqués par id — ne pas écraser la lignée.
    const scoreOf = (m: CaseEntity): number =>
      canonical.type === "person"
        ? personSimilarity(canonical.label, m.label)
        : denominationSimilarity(canonical.label, m.label);
    const historical = new Map<string, MergeMember>();
    for (const m of members) {
      const prior = m.attributes?.["__mergedFrom"];
      if (prior) {
        try {
          for (const pm of JSON.parse(prior) as MergeMember[]) {
            if (pm && typeof pm.id === "string") historical.set(pm.id, pm);
          }
        } catch {
          /* provenance illisible : ignorée */
        }
      }
      if (m.id !== canonical.id) {
        historical.set(m.id, {
          id: m.id,
          label: m.label,
          score: Math.round(scoreOf(m) * 100) / 100,
        });
      }
    }
    historical.delete(canonical.id);

    if (historical.size > 0) {
      const memberScores = [...historical.values()];
      const avg =
        memberScores.reduce((s, m) => s + m.score, 0) / memberScores.length;
      attributes["Entités fusionnées"] = String(memberScores.length + 1);
      attributes["Score de rapprochement"] = `${Math.round(avg * 100)} %`;
      attributes["__mergedFrom"] = JSON.stringify(memberScores);
      // `merges` ne rapporte que les fusions EFFECTUÉES cette passe (≥ 2 entrées
      // dans le groupe) ; la lignée __mergedFrom reste cumulative pour les
      // ré-résolutions (idempotence : une 2e passe ne produit aucune fusion).
      if (members.length > 1) {
        merges.push({
          canonicalId: canonical.id,
          type: canonical.type,
          members: memberScores,
          averageScore: avg,
        });
      }
    }

    resolvedEntities.push({
      ...canonical,
      attributes,
      evidenceLevel: level,
    });
  }

  // 5. Re-pointer les arêtes, supprimer les boucles, dédupliquer par
  //    (type | source | cible) en gardant le niveau de preuve le plus fort.
  const remap = (id: string): string => idMap[id] ?? id;
  const edgeByKey = new Map<string, CaseEdge>();
  for (const edge of input.edges) {
    const src = remap(edge.source);
    const tgt = remap(edge.target);
    if (src === tgt) continue; // boucle créée par la fusion
    const key = `${edge.type}|${src}|${tgt}`;
    const next: CaseEdge = {
      ...edge,
      id: `e:${edge.type}:${src}:${tgt}`,
      source: src,
      target: tgt,
    };
    const existing = edgeByKey.get(key);
    if (!existing) {
      edgeByKey.set(key, next);
      continue;
    }
    if (EVIDENCE_RANK[edge.evidenceLevel] > EVIDENCE_RANK[existing.evidenceLevel]) {
      edgeByKey.set(key, next);
    }
  }

  return {
    entities: resolvedEntities,
    edges: [...edgeByKey.values()],
    merges,
    idMap,
  };
}

/** Regroupe les entités par clé de blocking (les groupes sont comparés en interne). */
function groupByBlock(
  entities: CaseEntity[],
  keyOf: (e: CaseEntity) => string,
): CaseEntity[][] {
  const buckets = new Map<string, CaseEntity[]>();
  for (const e of entities) {
    const key = keyOf(e) || e.id;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  return [...buckets.values()];
}
