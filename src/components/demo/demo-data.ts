import { demoBundle } from "@/lib/fixtures/case-demo";
import { materializeCase } from "@/lib/fixtures/materialize";
import type {
  CaseEntity,
  CaseEvent,
  EvidenceLevel,
  NodeKind,
} from "@/lib/graph/graph-types";

/**
 * Modèle data-driven de la démo guidée (/demo). Les libellés, niveaux de
 * preuve et scores viennent du dossier fixture `case-demo.ts` (source unique) ;
 * seuls la mise en page (positions fractionnelles), l'ordre d'apparition et le
 * contenu des alertes sont définis ici. Même approche que
 * `landing/mockup/graph-data.ts` (helpers géométriques purs, zéro dépendance UI).
 */

export type DemoLabelPos = "top" | "right" | "bottom" | "left";

export type DemoNode = {
  id: string;
  label: string;
  kind: NodeKind;
  evidence: EvidenceLevel;
  /** Position en fraction de la zone graphe (0–1) — responsive sans re-layout. */
  fx: number;
  fy: number;
  /** Rayon en px (constant quel que soit l'écran). */
  r: number;
  labelPos: DemoLabelPos;
  main?: boolean;
};

export type DemoEdge = {
  id: string;
  source: string;
  target: string;
  evidence: EvidenceLevel;
  /** Nombre de nœuds visibles à partir duquel l'arête se trace. */
  appearIndex: number;
  /** Preuve simulée → trait pointillé (comme le vrai graphe). */
  dashed: boolean;
};

function mustEntity(id: string): CaseEntity {
  const entity = demoBundle.entities.find((e) => e.id === id);
  if (!entity) throw new Error(`Entité démo introuvable : ${id}`);
  return entity;
}

function mustEvent(id: string): CaseEvent {
  const event = demoBundle.events.find((ev) => ev.id === id);
  if (!event) throw new Error(`Événement démo introuvable : ${id}`);
  return event;
}

function fromEntity(id: string) {
  const e = mustEntity(id);
  return { id: e.id, label: e.label, kind: e.type, evidence: e.evidenceLevel };
}

function fromEvent(id: string) {
  const ev = mustEvent(id);
  return {
    id: ev.id,
    label: ev.title,
    kind: "event" as NodeKind,
    evidence: ev.evidenceLevel,
  };
}

/**
 * Ordre d'apparition du brief : holding d'abord, dirigeant, sociétés, adresses,
 * événements, et la correspondance sanction en dernier (climax du récit).
 * Disposition calquée sur le rendu ForceAtlas2 du vrai graphe.
 */
export const DEMO_NODES: DemoNode[] = [
  { ...fromEntity("c1"), fx: 0.62, fy: 0.47, r: 26, labelPos: "right", main: true },
  { ...fromEntity("p1"), fx: 0.43, fy: 0.3, r: 14, labelPos: "top" },
  { ...fromEntity("c3"), fx: 0.35, fy: 0.61, r: 16, labelPos: "right" },
  { ...fromEntity("c2"), fx: 0.49, fy: 0.15, r: 16, labelPos: "top" },
  { ...fromEntity("a2"), fx: 0.185, fy: 0.5, r: 11, labelPos: "top" },
  { ...fromEntity("a1"), fx: 0.7, fy: 0.21, r: 11, labelPos: "right" },
  { ...fromEvent("ev2"), fx: 0.84, fy: 0.6, r: 11, labelPos: "bottom" },
  { ...fromEvent("ev3"), fx: 0.43, fy: 0.86, r: 11, labelPos: "bottom" },
  { ...fromEvent("ev1"), fx: 0.215, fy: 0.77, r: 12, labelPos: "bottom" },
  { ...fromEntity("s1"), fx: 0.76, fy: 0.8, r: 14, labelPos: "bottom" },
];

const NODE_INDEX = new Map(DEMO_NODES.map((n, i) => [n.id, i]));

export function findDemoNode(id: string): DemoNode {
  const node = DEMO_NODES.find((n) => n.id === id);
  if (!node) throw new Error(`Nœud démo introuvable : ${id}`);
  return node;
}

function demoEdge(
  id: string,
  source: string,
  target: string,
  evidence: EvidenceLevel,
): DemoEdge {
  const si = NODE_INDEX.get(source);
  const ti = NODE_INDEX.get(target);
  if (si === undefined || ti === undefined)
    throw new Error(`Arête démo sans nœud : ${id} (${source} → ${target})`);
  return {
    id,
    source,
    target,
    evidence,
    appearIndex: Math.max(si, ti) + 1,
    dashed: evidence === "simulated",
  };
}

/** 9 liens du dossier + rattachement visuel des événements (comme le vrai graphe). */
export const DEMO_EDGES: DemoEdge[] = [
  ...demoBundle.edges.map((e) => demoEdge(e.id, e.source, e.target, e.evidenceLevel)),
  ...demoBundle.events.map((ev) =>
    demoEdge(`pub-${ev.id}`, ev.entityId, ev.id, ev.evidenceLevel),
  ),
];

/** Arête mise en évidence par l'alerte « structure opaque » (phase 5). */
export const SUSPECT_EDGE_ID = "e9";

export type DemoAlertSeverity = "warning" | "error" | "info";

export type DemoAlert = {
  id: string;
  severity: DemoAlertSeverity;
  /** Nœud près duquel la carte s'affiche (desktop) ; absent = barre du bas. */
  anchorNodeId?: string;
  anchorSide?: "left" | "right";
  /** Couleur de l'anneau pulsé sur le nœud déclencheur. */
  ringColor?: string;
  /** Décalage d'affichage depuis le début de la phase 4 (ms). */
  offsetMs: number;
  /** Durée d'affichage (ms) ; absent = visible jusqu'au CTA. */
  holdMs?: number;
  /** L'alerte allume le flux animé sur l'arête suspecte. */
  activatesSuspectEdge?: boolean;
  title: string;
  description: string;
  badges: string[];
};

// TODO(compliance): faire valider les références légales ci-dessous avant tout
// usage public. Écarts assumés vs brief v3 : l'art. L.511-41 CMF (solvabilité
// prudentielle des établissements de crédit) est remplacé par l'art. L.561-10
// CMF (vigilance renforcée LCB-FT), adapté à une procédure collective chez une
// contrepartie ; la source du screening est le registre des gels (DG Trésor,
// cf. fixture s1), pas le BODACC.
export const DEMO_ALERTS: DemoAlert[] = [
  {
    id: "correspondance-suspecte",
    severity: "warning",
    anchorNodeId: "s1",
    anchorSide: "left",
    ringColor: "var(--kyb-orange)",
    offsetMs: 5000,
    holdMs: 3000,
    title: "Correspondance suspecte détectée",
    description:
      "L'entité « MARTIN HOLDING LTD » présente une correspondance approximative avec le registre national des gels. Vérification obligatoire au titre de l'art. L.561-5 CMF (LCB-FT).",
    badges: ["DG Trésor — gels des avoirs"],
  },
  {
    id: "procedure-collective",
    severity: "error",
    anchorNodeId: "ev1",
    anchorSide: "right",
    ringColor: "var(--kyb-red)",
    offsetMs: 6300,
    holdMs: 3500,
    title: "Procédure collective active",
    description:
      "SCI DU PARC fait l'objet d'un redressement judiciaire publié au BODACC. Risque de défaillance — vigilance renforcée requise (art. L.561-10 CMF).",
    badges: ["BODACC", "Vigilance renforcée"],
  },
  {
    id: "structure-opaque",
    severity: "warning",
    offsetMs: 7800,
    activatesSuspectEdge: true,
    title: "Structure potentiellement opaque",
    description:
      "Présence d'une entité étrangère non identifiée dans la chaîne de détention. Déclaration aux autorités compétentes à évaluer (TRACFIN / règlement (UE) 2024/1624 — AMLR).",
    badges: ["AMLR 2024", "LCB-FT", "RGPD"],
  },
];

// Scores RECALCULÉS du graphe (mêmes calculs que le case-view) — aucune valeur
// en dur dans la démo (cf. docs/audit-calculs.md).
export const DEMO_SCORES = materializeCase(demoBundle).case.scores ?? {};
export const DEMO_SIREN = demoBundle.case.rootSiren;
export const DEMO_CASE_TITLE = demoBundle.case.title;
export const DEMO_ENTITY_COUNT = demoBundle.entities.length;
export const DEMO_EDGE_COUNT = demoBundle.edges.length;

/** Sources réellement interrogées par le produit (cf. fixtures) — pas celles,
 *  approximatives, du brief (Infogreffe / AMF). */
export const DEMO_SOURCES_LINE =
  "Interrogation des sources officielles… INSEE Sirene · RNE · BODACC · registre des gels (DG Trésor)";

/** Chronologie du brief v3. Les phases 1–3 dépendent de la frappe (aléatoire) ;
 *  tout le reste est ancré sur T = début de la phase 4 (brief : 4,2 s). */
export const TIMING = {
  /** Fade-in de l'interface (phase 1) puis début de frappe. */
  uiFadeIn: 800,
  /** Délai aléatoire entre deux caractères (brief : 80–180 ms). */
  keyGapMin: 80,
  keyGapMax: 180,
  /** Pause après le dernier chiffre, puis pulse du bouton de recherche. */
  searchPause: 400,
  searchClick: 150,
  /** Durée du squelette de chargement (phase 3). */
  loading: 1200,
  /** Cadence d'apparition des nœuds (phase 4). */
  nodeStep: 300,
  /** Fondu de sortie des cartes d'alerte. */
  cardFadeOut: 400,
  /** Décalages depuis T : scores (brief 13 s) et CTA (brief 15,5 s). */
  phaseScores: 8800,
  phaseCta: 11300,
  /** Durée de comptage des KPI (phase 6). */
  kpiDuration: 1200,
} as const;
