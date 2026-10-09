/**
 * Données du graphe de démonstration du landing (dossier « Holding
 * Patrimoniale »). Fixtures fictives, reprises de la maquette Claude Design
 * `KYB Graph Accueil` — niveaux de preuve attribués par nœud et par lien.
 * Aucun JSX / hook : importable depuis les îlots client comme serveur.
 */

export type Proof = "confirme" | "declare" | "infere" | "simule";
export type Side = "top" | "right" | "bottom" | "left";
export type Direction = "a" | "b";

export interface KgNode {
  id: string;
  label: string;
  type: string;
  proof: Proof;
  main?: boolean;
}

export interface KgEdge {
  id: string;
  s: string;
  t: string;
  proof: Proof;
  label?: string;
}

export const KG_NODES: KgNode[] = [
  { id: "holding", label: "HOLDING PATRIMONIALE SAS", type: "Société", proof: "confirme", main: true },
  { id: "jean", label: "Jean MARTIN", type: "Personne", proof: "declare" },
  { id: "sci1", label: "SCI LES TILLEULS", type: "Société", proof: "declare" },
  { id: "addr", label: "8 av. du Parc", type: "Adresse", proof: "confirme" },
  { id: "rcs", label: "Immatriculation RCS", type: "Source", proof: "confirme" },
  { id: "sci2", label: "SCI DU PARC", type: "Société", proof: "declare" },
  { id: "bod", label: "Jugement (BODACC)", type: "Risque", proof: "confirme" },
  { id: "corr", label: "« MARTIN HOLDING LTD »", type: "Étranger", proof: "infere" },
];

export const KG_EDGES: KgEdge[] = [
  { id: "e1", s: "holding", t: "jean", proof: "declare", label: "dirigé par" },
  { id: "e2", s: "holding", t: "sci1", proof: "declare", label: "détient" },
  { id: "e3", s: "holding", t: "addr", proof: "confirme" },
  { id: "e4", s: "holding", t: "sci2", proof: "declare", label: "détient" },
  { id: "e5", s: "holding", t: "rcs", proof: "confirme" },
  { id: "e6", s: "holding", t: "corr", proof: "infere" },
  { id: "e7", s: "sci2", t: "bod", proof: "infere" },
  { id: "e8", s: "jean", t: "sci1", proof: "declare" },
];

export const PROOF: Record<Proof, { label: string; verify?: boolean }> = {
  confirme: { label: "Confirmé" },
  declare: { label: "Déclaré" },
  infere: { label: "Inféré", verify: true },
  simule: { label: "Simulé", verify: true },
};

export interface Entity {
  label: string;
  type: string;
  siren: string;
  score: number;
  links: number;
  statut: string;
  pays: string;
  proof: Proof;
  note: string;
  resume: string;
}

export const ENT: Record<string, Entity> = {
  holding: { label: "HOLDING PATRIMONIALE SAS", type: "Société", siren: "900 111 222", score: 78, links: 9, statut: "Active", pays: "France", proof: "confirme", note: "Infogreffe / RCS · confiance élevée", resume: "Structure complexe avec liens personnes et correspondances. Vérifications complémentaires recommandées." },
  jean: { label: "Jean MARTIN", type: "Personne", siren: "—", score: 62, links: 3, statut: "Dirigeant actif", pays: "France", proof: "declare", note: "Mandat déclaré · rôle à confirmer", resume: "Dirige plusieurs entités liées ; rôle exact sur la chaîne de détention à confirmer." },
  sci1: { label: "SCI LES TILLEULS", type: "Société", siren: "812 444 901", score: 71, links: 2, statut: "Active", pays: "France", proof: "declare", note: "Détention déclarée · gérance à vérifier", resume: "SCI détenue par la holding ; cohérence d'adresse et de gérance à vérifier." },
  sci2: { label: "SCI DU PARC", type: "Société", siren: "799 220 118", score: 69, links: 3, statut: "Active", pays: "France", proof: "declare", note: "Détention déclarée · événement lié", resume: "SCI liée à un événement BODACC à qualifier." },
  addr: { label: "8 avenue du Parc, 69006 Lyon", type: "Adresse", siren: "—", score: 90, links: 2, statut: "Confirmée", pays: "France", proof: "confirme", note: "INSEE Sirene · confiance élevée", resume: "Adresse partagée par plusieurs entités du dossier." },
  rcs: { label: "Immatriculation RCS", type: "Source officielle", siren: "—", score: 88, links: 1, statut: "Vérifiée", pays: "France", proof: "confirme", note: "Infogreffe / RCS · confiance élevée", resume: "Immatriculation confirmée au registre du commerce et des sociétés." },
  corr: { label: "« MARTIN HOLDING LTD »", type: "Correspondance étrangère", siren: "—", score: 34, links: 1, statut: "À vérifier", pays: "Étranger", proof: "infere", note: "Proximité de graphe · confiance faible", resume: "Correspondance de nom avec une entité étrangère ; proximité de graphe à qualifier avant toute conclusion." },
  bod: { label: "Jugement (BODACC)", type: "Événement", siren: "—", score: 55, links: 1, statut: "À qualifier", pays: "France", proof: "confirme", note: "BODACC · confiance moyenne", resume: "Annonce BODACC détectée ; nature et portée à documenter." },
};

/* ── Mise en page ─────────────────────────────────────────────────────── */

interface Spec {
  w: number;
  h: number;
  d0: number;
  reach: number;
  pos: Record<string, [number, number, number, Side]>;
  ambient?: { count: number; seed: number; x0: number; x1: number; avoid: [number, number, number, number] };
}

const SPEC_A: Spec = {
  w: 800, h: 600, d0: 0.2, reach: 230,
  pos: {
    holding: [420, 300, 15, "right"], jean: [270, 140, 9, "top"], sci1: [560, 112, 9, "top"], addr: [118, 285, 8, "top"],
    rcs: [650, 210, 8, "top"], sci2: [205, 450, 9, "left"], bod: [380, 520, 8, "bottom"], corr: [625, 468, 9, "bottom"],
  },
};

const SPEC_B: Spec = {
  w: 1440, h: 860, d0: 0.35, reach: 300,
  pos: {
    holding: [1080, 360, 18, "right"], jean: [920, 190, 10, "top"], sci1: [1210, 130, 10, "top"], addr: [840, 350, 9, "top"],
    rcs: [1300, 255, 9, "top"], sci2: [880, 520, 10, "left"], bod: [1050, 590, 9, "bottom"], corr: [1250, 520, 10, "bottom"],
  },
  ambient: { count: 58, seed: 11, x0: -320, x1: 1760, avoid: [40, 70, 760, 800] },
};

export interface LNode extends KgNode { x: number; y: number; r: number; side: Side; delay: number }
export interface LEdge extends KgEdge { delay: number }
export interface APoint { id: string; x: number; y: number; r: number; delay: number }
export interface ALink { id: string; s: string; t: string; delay: number }

export interface Layout {
  w: number;
  h: number;
  reach: number;
  nodes: LNode[];
  edges: LEdge[];
  by: Record<string, LNode>;
  amb: { pts: APoint[]; links: ALink[] } | null;
}

/** PRNG déterministe (mulberry32) : même nuage ambiant au serveur et au client. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLayout(spec: Spec): Layout {
  const nodes: LNode[] = KG_NODES.map((n, i) => {
    const p = spec.pos[n.id];
    return { ...n, x: p[0], y: p[1], r: p[2], side: p[3], delay: spec.d0 + (i === 0 ? 0 : 0.2 + i * 0.09) };
  });
  const by: Record<string, LNode> = {};
  nodes.forEach((n) => (by[n.id] = n));
  const edges: LEdge[] = KG_EDGES.map((e) => ({ ...e, delay: Math.max(by[e.s].delay, by[e.t].delay) + 0.05 }));

  let amb: Layout["amb"] = null;
  if (spec.ambient) {
    const A = spec.ambient, R = rng(A.seed), pts: APoint[] = [], av = A.avoid;
    let guard = 0;
    while (pts.length < A.count && guard++ < 4000) {
      const x = A.x0 + R() * (A.x1 - A.x0), y = 24 + R() * (spec.h - 48);
      if (x > av[0] && x < av[2] && y > av[1] && y < av[3] && R() > 0.1) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 80)) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 62)) continue;
      pts.push({ id: "a" + pts.length, x, y, r: 1.3 + R() * 1.5, delay: 0.9 + R() * 1.6 });
    }
    const links: ALink[] = [], seen: Record<string, 1> = {};
    pts.forEach((p) => {
      pts
        .filter((q) => q !== p)
        .map((q) => ({ q, d: Math.hypot(p.x - q.x, p.y - q.y) }))
        .filter((o) => o.d < 210)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .forEach((o) => {
          const k = p.id < o.q.id ? p.id + "-" + o.q.id : o.q.id + "-" + p.id;
          if (seen[k]) return;
          seen[k] = 1;
          links.push({ id: k, s: p.id, t: o.q.id, delay: Math.max(p.delay, o.q.delay) + 0.2 });
        });
    });
    amb = { pts, links };
  }
  return { w: spec.w, h: spec.h, nodes, edges, by, amb, reach: spec.reach };
}

export const LAYOUT_A = buildLayout(SPEC_A);
export const LAYOUT_B = buildLayout(SPEC_B);

/* ── Thèmes graphe (1a Registre = jour, 1b Nuit = nuit) ──────────────── */

export interface GraphTheme {
  bg: string;
  ink: string;
  ink2: string;
  line: string;
  accent: string;
  warn: string;
  sans: string;
  mono: string;
  label: number;
  cap: number;
  weight: number;
  ambNode?: number;
  ambEdge?: number;
  tipBg: string;
  tipShadow: string;
}

export const THEME_A: GraphTheme = {
  bg: "oklch(0.985 0.003 255)", ink: "oklch(0.22 0.02 258)", ink2: "oklch(0.45 0.015 258)", line: "oklch(0.7 0.012 258)",
  accent: "oklch(0.5 0.15 258)", warn: "oklch(0.56 0.15 45)",
  sans: "var(--font-kg-instrument), system-ui, sans-serif", mono: "var(--font-kg-jetbrains), ui-monospace, monospace",
  label: 13.5, cap: 9.5, weight: 600,
  tipBg: "oklch(1 0 0)", tipShadow: "0 12px 32px -14px oklch(0.22 0.02 258 / 0.4), 0 0 0 1px oklch(0.9 0.006 258)",
};

export const THEME_B: GraphTheme = {
  bg: "oklch(0.165 0.01 235)", ink: "oklch(0.965 0.004 235)", ink2: "oklch(0.72 0.012 235)", line: "oklch(0.52 0.014 235)",
  accent: "oklch(0.8 0.11 200)", warn: "oklch(0.8 0.11 70)",
  sans: "var(--font-kg-public), system-ui, sans-serif", mono: "var(--font-kg-geist-mono), ui-monospace, monospace",
  label: 14.5, cap: 10, weight: 600, ambNode: 0.3, ambEdge: 0.4,
  tipBg: "oklch(0.21 0.012 235)", tipShadow: "0 14px 40px -12px rgba(0,0,0,.65), 0 0 0 1px oklch(0.32 0.012 235)",
};

/** Style de trait de légende par niveau de preuve. */
export const LINE_STYLE: Record<Proof, "solid" | "dashed" | "dotted"> = {
  confirme: "solid",
  declare: "solid",
  infere: "dashed",
  simule: "dotted",
};

export const lineColor = (t: GraphTheme): Record<Proof, string> => ({
  confirme: t.ink,
  declare: t.line,
  infere: t.warn,
  simule: t.ink2,
});

/** Intensité d'animation (réglage « Modérée » de la maquette). */
export const MOTION = 1;
