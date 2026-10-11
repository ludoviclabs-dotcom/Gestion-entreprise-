/*
 * Vue « Registre / Nuit » du graphe d'un dossier — logique PURE (sans DOM),
 * partagée par la scène SVG, la fiche, la vue table et le curseur temporel.
 *
 *  - `buildGraphView` : assemble le DTO pré-layouté (serveur) et le bundle métier
 *    (attributs, validité temporelle des liens, sources) en un modèle de vue ;
 *  - `layoutGraphView` : mise en page radiale déterministe autour de l'entité
 *    racine (anneaux par distance, ordre angulaire repris de ForceAtlas2), les
 *    événements publiés sur une ellipse extérieure ;
 *  - `computeVisibility` : couches + « qui contrôlait quand » à une date donnée ;
 *  - `searchMatches` : recherche insensible à la casse et aux accents.
 */

import type {
  CaseBundle,
  EdgeKind,
  EvidenceLevel,
  GraphDTO,
  LayerKey,
  NodeKind,
} from "./graph-types";
import { layerForEdgeType, layerForNodeKind } from "./graph-types";

/** Largeur du repère de la scène (unités SVG). La hauteur suit le format du cadre. */
export const VIEW_W = 1400;
export const VIEW_H = 860;

export type LabelSide = "right" | "left" | "top" | "bottom";

export type ViewNode = {
  id: string;
  kind: NodeKind;
  label: string;
  /** Libellé abrégé affiché sur la scène (le libellé complet reste dans la fiche). */
  short: string;
  evidence: EvidenceLevel;
  cluster: number;
  /** Entité racine du dossier (celle du SIREN suivi). */
  main: boolean;
  /** Date de l'événement (événements publiés uniquement). */
  date?: string;
  attrs: Record<string, string>;
  source?: string;
  excerpt?: string;
  /** Coordonnées ForceAtlas2 (serveur) : ne servent qu'à l'ordre angulaire. */
  fx: number;
  fy: number;
};

export type ViewEdge = {
  id: string;
  source: string;
  target: string;
  type: EdgeKind;
  evidence: EvidenceLevel;
  /** Libellé métier (« détient 66 % », « préside »…), absent s'il ne fait que répéter le type. */
  label?: string;
  weight?: string;
  /** Validité temporelle (date de calendrier AAAA-MM-JJ). */
  from?: string;
  to?: string;
  excerpt?: string;
  sourceLabel?: string;
};

export type GraphView = {
  nodes: ViewNode[];
  edges: ViewEdge[];
  byId: Record<string, ViewNode>;
  rootId: string | null;
  /** Bornes du curseur temporel ; `timeStart` nul si aucun lien ni événement n'est daté. */
  timeStart: string | null;
  timeEnd: string;
  /** Nombre d'entités (hors événements) au-delà duquel les libellés secondaires se replient. */
  dense: boolean;
};

export const DENSE_THRESHOLD = 36;

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
/** Date de calendrier AAAA-MM-JJ (ou `undefined`) depuis une date ISO quelconque. */
export function calendarDate(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

export function shortLabel(s: string, n = 26): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** « depot_comptes » → « Depot comptes » : nature lisible d'un événement sans table dédiée. */
function humanize(kind: string): string {
  const s = kind.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : kind;
}

/**
 * Entité racine : celle dont le SIREN est celui du dossier ; à défaut la
 * première société du bundle ; à défaut le premier nœud.
 */
export function findRootId(dto: GraphDTO, bundle: CaseBundle): string | null {
  const ids = new Set(dto.nodes.map((n) => n.id));
  const siren = digits(bundle.case.rootSiren);
  if (siren) {
    const bySiren = bundle.entities.find(
      (e) => ids.has(e.id) && digits(e.attributes?.SIREN) === siren,
    );
    if (bySiren) return bySiren.id;
  }
  const company = bundle.entities.find((e) => ids.has(e.id) && e.type === "company");
  if (company) return company.id;
  return dto.nodes[0]?.id ?? null;
}

export function buildGraphView(dto: GraphDTO, bundle: CaseBundle, today: string): GraphView {
  const entityById = new Map(bundle.entities.map((e) => [e.id, e]));
  const eventById = new Map(bundle.events.map((e) => [e.id, e]));
  const edgeById = new Map(bundle.edges.map((e) => [e.id, e]));
  const rootId = findRootId(dto, bundle);

  const nodes: ViewNode[] = dto.nodes.map((n) => {
    const entity = entityById.get(n.id);
    const event = n.kind === "event" ? eventById.get(n.id) : undefined;
    const date = calendarDate(event?.occurredOn);
    const attrs: Record<string, string> = entity?.attributes
      ? { ...entity.attributes }
      : event
        ? {
            ...(date ? { Date: date.split("-").reverse().join("/") } : {}),
            Nature: humanize(event.kind),
          }
        : {};
    return {
      id: n.id,
      kind: n.kind,
      label: n.label,
      short: shortLabel(n.label, n.kind === "event" ? 40 : 26),
      evidence: n.evidenceLevel,
      cluster: n.cluster,
      main: n.id === rootId,
      date,
      attrs,
      source: entity?.source ?? event?.source,
      excerpt: entity?.excerpt,
      fx: n.x,
      fy: n.y,
    };
  });
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const edges: ViewEdge[] = dto.edges
    .filter((e) => byId[e.source] && byId[e.target])
    .map((e) => {
      const b = edgeById.get(e.id);
      const event = e.type === "A_PUBLIE" ? eventById.get(e.target) : undefined;
      const label = e.label && e.label !== e.type ? e.label : undefined;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        evidence: e.evidenceLevel,
        label: e.type === "A_PUBLIE" ? undefined : label,
        weight: e.weight,
        from: calendarDate(b?.validFrom) ?? calendarDate(event?.occurredOn),
        to: calendarDate(b?.validTo),
        excerpt: b?.excerpt,
        sourceLabel: b?.sourceLabel ?? event?.source,
      };
    });

  const { timeStart, timeEnd } = timeBounds(edges, today);
  const structural = nodes.filter((n) => n.kind !== "event").length;
  return { nodes, edges, byId, rootId, timeStart, timeEnd, dense: structural > DENSE_THRESHOLD };
}

/** Bornes du curseur : plus ancienne date de validité connue → aujourd'hui. */
export function timeBounds(
  edges: Pick<ViewEdge, "from" | "to">[],
  today: string,
): { timeStart: string | null; timeEnd: string } {
  let min: string | null = null;
  for (const e of edges) {
    for (const d of [e.from, e.to]) if (d && (!min || d < min)) min = d;
  }
  return { timeStart: min && min < today ? min : null, timeEnd: today };
}

/** Date (AAAA-MM-JJ) à la fraction `frac` ∈ [0, 1] de l'intervalle. */
export function dateAtFraction(start: string, end: string, frac: number): string {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  return new Date(a + (b - a) * f).toISOString().slice(0, 10);
}

// ── Mise en page radiale « registre » ─────────────────────────────────────────

export type NodePlacement = { x: number; y: number; r: number; side: LabelSide; delay: number };

const TWO_PI = Math.PI * 2;
const normAngle = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

/** PRNG déterministe (mulberry32) : même nuage d'événements à chaque rendu. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Libellé toujours vers l'extérieur ; centré dessus / dessous seulement à la verticale. */
export function sideOf(dx: number, dy: number, strict = 0.1): LabelSide {
  if (Math.abs(dx) >= strict) return dx >= 0 ? "right" : "left";
  return dy < 0 ? "top" : "bottom";
}

function radiusOf(n: ViewNode): number {
  if (n.main) return 18;
  switch (n.kind) {
    case "event":
      return 3;
    case "address":
      return 8;
    case "person":
      return 9;
    default:
      return 10;
  }
}

/**
 * Répartit des angles préférés sur un anneau avec un écart minimal `gap`. Si
 * l'anneau est trop chargé, espacement régulier (décalé pour respecter au mieux
 * l'ordre et l'orientation d'origine).
 */
export function spreadAngles(prefs: number[], gap: number): number[] {
  const n = prefs.length;
  const out = new Array<number>(n);
  if (n === 0) return out;
  const order = prefs.map((p, i) => ({ p: normAngle(p), i })).sort((a, b) => a.p - b.p);
  if (n === 1) {
    out[order[0].i] = order[0].p;
    return out;
  }
  if (n * gap >= TWO_PI * 0.8) {
    const step = TWO_PI / n;
    let sx = 0;
    let sy = 0;
    order.forEach(({ p }, k) => {
      sx += Math.cos(p - k * step);
      sy += Math.sin(p - k * step);
    });
    const off = Math.atan2(sy, sx);
    order.forEach(({ i }, k) => (out[i] = off + k * step));
    return out;
  }
  const a = order.map((o) => o.p);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let k = 0; k < n; k++) {
      const next = (k + 1) % n;
      const g = a[next] - a[k] + (next === 0 ? TWO_PI : 0);
      if (g < gap - 1e-9) {
        const push = (gap - g) / 2;
        a[k] -= push;
        a[next] += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  order.forEach(({ i }, k) => (out[i] = a[k]));
  return out;
}

/**
 * Positions de tous les nœuds dans un repère `w × h` :
 *  - racine au centre ;
 *  - entités sur des anneaux elliptiques selon leur distance (en liens de
 *    structure) à la racine ; l'ordre autour de l'anneau suit l'angle
 *    ForceAtlas2 (anneau 1) puis l'angle moyen des parents (anneaux suivants) ;
 *  - entités non reliées à la racine sur l'anneau extérieur des entités ;
 *  - événements publiés sur une ellipse extérieure, regroupés par émetteur.
 */
export function layoutGraphView(view: GraphView, w = VIEW_W, h = VIEW_H): Record<string, NodePlacement> {
  const cx = w / 2;
  const cy = h / 2;
  const out: Record<string, NodePlacement> = {};
  const structural = view.nodes.filter((n) => n.kind !== "event");
  const events = view.nodes.filter((n) => n.kind === "event");
  const isStructural = new Set(structural.map((n) => n.id));

  const adj = new Map<string, Set<string>>(structural.map((n) => [n.id, new Set<string>()]));
  for (const e of view.edges) {
    if (e.type === "A_PUBLIE" || !isStructural.has(e.source) || !isStructural.has(e.target)) continue;
    if (e.source === e.target) continue;
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  // Distances (BFS non orienté) depuis la racine.
  const root = view.rootId && isStructural.has(view.rootId) ? view.rootId : null;
  const depth = new Map<string, number>();
  if (root) {
    depth.set(root, 0);
    const queue = [root];
    while (queue.length) {
      const id = queue.shift()!;
      for (const nb of adj.get(id) ?? []) {
        if (!depth.has(nb)) {
          depth.set(nb, depth.get(id)! + 1);
          queue.push(nb);
        }
      }
    }
  }
  let maxDepth = 0;
  depth.forEach((d) => (maxDepth = Math.max(maxDepth, d)));
  // Entités sans chemin vers la racine : anneau juste après le plus éloigné.
  const orphanRing = root ? maxDepth + 1 : 1;
  for (const n of structural) if (!depth.has(n.id)) depth.set(n.id, orphanRing);
  let rings = 1;
  depth.forEach((d) => (rings = Math.max(rings, d)));

  // Ellipses : rayon horizontal fixe (libellés horizontaux), vertical selon le cadre.
  const RX = Math.min(400, w / 2 - 260);
  const RY = Math.max(150, Math.min(h / 2 - 120, 460));
  const ringScale = (k: number) => (rings === 1 ? 1 : 0.42 + 0.58 * (k / rings));

  const ref = root ? view.byId[root] : null;
  const refX = ref ? ref.fx : structural.reduce((s, n) => s + n.fx, 0) / (structural.length || 1);
  const refY = ref ? ref.fy : structural.reduce((s, n) => s + n.fy, 0) / (structural.length || 1);
  const faAngle = (n: ViewNode) => Math.atan2(n.fy - refY, n.fx - refX);

  const angle = new Map<string, number>();
  let order = 0;
  if (root) {
    out[root] = { x: cx, y: cy, r: radiusOf(view.byId[root]), side: "right", delay: 0.3 };
  }
  for (let k = 1; k <= rings; k++) {
    const ring = structural.filter((n) => depth.get(n.id) === k && n.id !== root);
    if (!ring.length) continue;
    const prefs = ring.map((n) => {
      if (k === 1) return faAngle(n);
      let sx = 0;
      let sy = 0;
      for (const nb of adj.get(n.id) ?? []) {
        if (depth.get(nb) === k - 1 && angle.has(nb)) {
          sx += Math.cos(angle.get(nb)!);
          sy += Math.sin(angle.get(nb)!);
        }
      }
      return sx || sy ? Math.atan2(sy, sx) : faAngle(n);
    });
    // Anneau 1 : espacement régulier (lecture « en étoile ») ; au-delà, écart minimal.
    const gap = k === 1 ? TWO_PI : Math.min(TWO_PI / ring.length, 0.17);
    const angles = spreadAngles(prefs, gap);
    const s = ringScale(k);
    ring
      .map((n, i) => ({ n, a: angles[i] }))
      .sort((p, q) => normAngle(p.a + Math.PI / 2) - normAngle(q.a + Math.PI / 2))
      .forEach(({ n, a }) => {
        angle.set(n.id, a);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        out[n.id] = {
          x: cx + RX * s * ca,
          y: cy + RY * s * sa,
          r: radiusOf(n),
          side: sideOf(ca, sa),
          delay: 0.5 + Math.min(order++, 40) * 0.03,
        };
      });
  }

  // Événements : ellipse extérieure, groupés par émetteur puis par date.
  // Leurs libellés pointent vers l'intérieur : aucun espace de lecture au-delà du bord.
  if (events.length) {
    const owner = new Map<string, string>();
    for (const e of view.edges) if (e.type === "A_PUBLIE") owner.set(e.target, e.source);
    const ownerKey = (n: ViewNode) => {
      const o = owner.get(n.id);
      return !o || o === root || !angle.has(o) ? -1 : normAngle(angle.get(o)! + Math.PI / 2);
    };
    const sorted = [...events].sort(
      (a, b) => ownerKey(a) - ownerKey(b) || (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id),
    );
    const R = rng(5);
    const ERX = w / 2 - 55;
    const ERY = h / 2 - 35;
    sorted.forEach((n, i) => {
      const a = -Math.PI / 2 + ((i + 0.5) / sorted.length) * TWO_PI + (R() - 0.5) * 0.028;
      const rx = ERX + (R() - 0.5) * 50;
      const ry = ERY + (R() - 0.5) * 30;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      out[n.id] = {
        x: cx + rx * ca,
        y: cy + ry * sa,
        r: radiusOf(n),
        side: sideOf(-ca, -sa, 0.45),
        delay: 0.9 + R() * 1.4,
      };
    });
  }
  return out;
}

// ── Visibilité : couches + date du curseur ────────────────────────────────────

export type Visibility = {
  nodes: Set<string>;
  edges: Set<string>;
  counts: { entities: number; links: number; events: number };
};

/**
 * Nœuds et liens visibles pour des couches données et, si `at` est fourni, à
 * cette date : un lien n'existe qu'entre sa date de début et sa date de fin ;
 * une entité sans aucun lien visible disparaît (sauf la racine).
 */
export function computeVisibility(
  view: GraphView,
  layers: Record<LayerKey, boolean>,
  at: string | null,
): Visibility {
  const layerOk = (n: ViewNode | undefined) => {
    if (!n) return false;
    const k = layerForNodeKind(n.kind);
    return !k || layers[k];
  };
  const incident = new Map<string, ViewEdge[]>(view.nodes.map((n) => [n.id, []]));
  const edgeOk = new Map<string, boolean>();
  for (const e of view.edges) {
    incident.get(e.source)?.push(e);
    incident.get(e.target)?.push(e);
    const k = layerForEdgeType(e.type);
    const inTime = !at || ((!e.from || e.from <= at) && (!e.to || e.to >= at));
    edgeOk.set(e.id, (!k || layers[k]) && inTime && layerOk(view.byId[e.source]) && layerOk(view.byId[e.target]));
  }
  const nodes = new Set<string>();
  for (const n of view.nodes) {
    if (!layerOk(n)) continue;
    const es = incident.get(n.id) ?? [];
    if (n.main || es.length === 0 || es.some((e) => edgeOk.get(e.id))) nodes.add(n.id);
  }
  const edges = new Set<string>();
  for (const e of view.edges) {
    if (edgeOk.get(e.id) && nodes.has(e.source) && nodes.has(e.target)) edges.add(e.id);
  }
  let entities = 0;
  let events = 0;
  let links = 0;
  for (const id of nodes) {
    if (view.byId[id].kind === "event") events++;
    else entities++;
  }
  for (const e of view.edges) if (edges.has(e.id) && e.type !== "A_PUBLIE") links++;
  return { nodes, edges, counts: { entities, links, events } };
}

// ── Recherche, comptes, ancienneté ────────────────────────────────────────────

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Identifiants dont le libellé (ou le SIREN) contient la requête. */
export function searchMatches(view: GraphView, query: string): Set<string> {
  const q = normalizeText(query.trim());
  if (!q) return new Set();
  const qDigits = /^[\d\s]+$/.test(q) ? digits(q) : "";
  return new Set(
    view.nodes
      .filter(
        (n) =>
          normalizeText(n.label).includes(q) ||
          (qDigits.length >= 3 && digits(n.attrs.SIREN).includes(qDigits)),
      )
      .map((n) => n.id),
  );
}

/** Liens de structure d'un nœud (sans les publications). */
export function structuralLinks(view: GraphView, id: string): ViewEdge[] {
  return view.edges.filter((e) => e.type !== "A_PUBLIE" && (e.source === id || e.target === id));
}

/** Plus ancienne date de début parmi les liens de structure d'un nœud. */
export function sinceOf(view: GraphView, id: string): string | undefined {
  const dates = structuralLinks(view, id)
    .map((e) => e.from)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0];
}
