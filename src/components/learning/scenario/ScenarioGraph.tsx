import type { KeyboardEvent, ReactNode } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Building2,
  Code,
  Coins,
  CreditCard,
  Database,
  FileBadge,
  FlaskConical,
  FolderLock,
  Handshake,
  Hash,
  Landmark,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { RelationKind, Scenario } from "@/lib/learning/schema";
import {
  knownClaimsOf,
  legAmount,
  movementLegs,
  objectById,
  objectLabel,
  relationShortLabel,
  type ScenarioState,
  type StateDiff,
} from "@/lib/learning/projections";
import { ACTOR_KIND_LABELS, RESOURCE_KIND_LABELS } from "@/lib/learning/labels";

export type Selection =
  | { type: "object"; id: string }
  | { type: "relation"; id: string }
  | { type: "event"; id: string }
  | null;

const W = 1000;
const H = 640;
const R_ACTOR = 28;
const R_SUBJECT = 36;
const R_RESOURCE = 24;

type EdgeGroup = "capital" | "titre" | "commercial" | "financier" | "technique" | "mouvement";

const EDGE_GROUP: Record<RelationKind, EdgeGroup> = {
  detention: "capital",
  controle: "capital",
  direction: "capital",
  titularite: "titre",
  dependance: "commercial",
  licence: "commercial",
  financement: "financier",
  surete: "financier",
  prestation: "technique",
  acces: "technique",
  titulaire_compte: "titre",
};

const GROUP_LABELS: Partial<Record<EdgeGroup, string>> = {
  titre: "Titularité d'un actif ou d'un compte",
};

/** Couleurs neutres : aucune ne signifie « menace ». La légende et les libellés doublent la couleur. */
export const EDGE_COLORS: Record<EdgeGroup, { color: string; label: string }> = {
  capital: { color: "#0ea5a3", label: "Capital, votes, direction" },
  titre: { color: "#94a3b8", label: "Titularité d'un actif" },
  commercial: { color: "#3b82f6", label: "Client, licence" },
  financier: { color: "#a855f7", label: "Prêt, sûreté" },
  technique: { color: "#65a30d", label: "Prestation, accès" },
  mouvement: { color: "#ea580c", label: "Mouvement de valeur (actif, montant)" },
};

const ACTOR_ICONS: Record<string, LucideIcon> = {
  entreprise: Building2,
  personne: User,
  investisseur: Briefcase,
  preteur: Banknote,
  banque: Landmark,
  client: Handshake,
  prestataire_technique: Wrench,
  prestataire_crypto: Coins,
};

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  brevet: FileBadge,
  logiciel: Code,
  donnees: Database,
  procede: FlaskConical,
  systeme: FolderLock,
  compte_bancaire: CreditCard,
  compte_prestataire: Wallet,
  adresse: Hash,
  contrat_intelligent: ArrowLeftRight,
};

/** Distance minimale d'un point à une courbe échantillonnée. */
function clearance(points: Pt[], obstacle: Pt): number {
  return Math.min(...points.map((p) => Math.hypot(p.x - obstacle.x, p.y - obstacle.y)));
}

function sampleQuad(a: Pt, ctrl: Pt, b: Pt, n = 16): Pt[] {
  const pts: Pt[] = [];
  for (let k = 1; k < n; k++) {
    const t = k / n;
    pts.push({
      x: (1 - t) ** 2 * a.x + 2 * t * (1 - t) * ctrl.x + t ** 2 * b.x,
      y: (1 - t) ** 2 * a.y + 2 * t * (1 - t) * ctrl.y + t ** 2 * b.y,
    });
  }
  return pts;
}

function wrap(text: string, max = 18): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

type Pt = { x: number; y: number };

function toward(from: Pt, to: Pt, dist: number): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
}

/**
 * Courbe quadratique entre deux nœuds, décalée pour séparer les relations
 * parallèles. Le libellé se place aux 2/5 depuis la source : les relations qui
 * convergent vers un même nœud n'empilent pas leurs libellés au centre.
 */
function edgePath(a: Pt, b: Pt, normal: Pt, offset: number, rA: number, rB: number, t = 0.4) {
  const ctrl = { x: (a.x + b.x) / 2 + normal.x * offset * 2, y: (a.y + b.y) / 2 + normal.y * offset * 2 };
  const s = toward(a, ctrl, rA + 2);
  const e = toward(b, ctrl, rB + 6);
  const [a0, a1, a2] = [(1 - t) ** 2, 2 * t * (1 - t), t ** 2];
  const label = { x: a0 * s.x + a1 * ctrl.x + a2 * e.x, y: a0 * s.y + a1 * ctrl.y + a2 * e.y };
  return { d: `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${ctrl.x.toFixed(1)},${ctrl.y.toFixed(1)} ${e.x.toFixed(1)},${e.y.toFixed(1)}`, label };
}

function activate(e: KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

/**
 * Graphe du scénario : disposition fixe (aucune simulation, aucune animation),
 * relations courbes quand elles sont parallèles, relations terminées en
 * pointillé estompé. Une relation n'est jamais animée (cadrage §9.3).
 */
export function ScenarioGraph({
  scenario,
  state,
  diff,
  selection,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  diff: StateDiff;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const pos = (id: string) => scenario.layout[id] ?? { x: W / 2, y: H / 2 };
  const radius = (id: string) =>
    id === scenario.subjectId ? R_SUBJECT : objectById(scenario, id)?.type === "resource" ? R_RESOURCE : R_ACTOR;
  const visible = new Set(state.objectIds);
  const added = new Set(diff.addedRelationIds);

  const addedEvents = new Set(diff.addedEventIds);

  type Edge = {
    key: string;
    id: string;
    type: "relation" | "event";
    source: string;
    target: string;
    group: EdgeGroup;
    text: string;
    ended: boolean;
    isNew: boolean;
    documented: boolean;
  };

  const relationEdge = (r: (typeof scenario.relations)[number], ended: boolean): Edge => ({
    key: `${r.id}${ended ? "-fin" : ""}`,
    id: r.id,
    type: "relation",
    source: r.source,
    target: r.target,
    group: EDGE_GROUP[r.kind],
    text: ended ? `terminé : ${relationShortLabel(r)}` : relationShortLabel(r),
    ended,
    isNew: !ended && added.has(r.id),
    documented: knownClaimsOf(scenario, state, r).some((c) => c.nature === "fait_documente"),
  });

  const edges: Edge[] = [
    ...diff.endedRelationIds
      .map((id) => scenario.relations.find((r) => r.id === id))
      .filter((r) => r !== undefined && visible.has(r.source) && visible.has(r.target))
      .map((r) => relationEdge(r!, true)),
    ...state.relations.map((r) => relationEdge(r, false)),
    // Les mouvements de valeur sur la chaîne ou en banque ; une écriture interne au prestataire n'a pas d'arête.
    ...state.events
      .filter((e) => e.layer !== "interne")
      .flatMap((e) =>
        movementLegs(e).map((l, i) => ({
          key: `${e.id}#${i}`,
          id: e.id,
          type: "event" as const,
          source: l.from,
          target: l.to,
          group: "mouvement" as const,
          text: legAmount(l),
          ended: false,
          isNew: addedEvents.has(e.id),
          documented: e.status === "confirme",
        })),
      ),
  ];

  // Regroupe les arêtes par paire d'objets pour les écarter les unes des autres.
  const pairs = new Map<string, number>();
  const pairIndex = edges.map((edge) => {
    const key = [edge.source, edge.target].sort().join("|");
    const i = pairs.get(key) ?? 0;
    pairs.set(key, i + 1);
    return { key, i };
  });

  const renderedEdges: ReactNode[] = [];
  const renderedLabels: ReactNode[] = [];
  edges.forEach((edge, n) => {
    const { key, i } = pairIndex[n];
    const count = pairs.get(key) ?? 1;
    const [first, second] = key.split("|");
    const p1 = pos(first);
    const p2 = pos(second);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const normal = { x: -(p2.y - p1.y) / len, y: (p2.x - p1.x) / len };
    let offset = (i - (count - 1) / 2) * 30;
    if (count === 1) {
      // Une arête seule qui traverserait un autre nœud est courbée pour le contourner.
      const a = pos(edge.source);
      const b = pos(edge.target);
      const obstacles = state.objectIds.filter((id) => id !== edge.source && id !== edge.target).map(pos);
      for (const candidate of [0, 30, -30, 60, -60, 90, -90, 120, -120]) {
        const ctrl = { x: (a.x + b.x) / 2 + normal.x * candidate * 2, y: (a.y + b.y) / 2 + normal.y * candidate * 2 };
        const pts = sampleQuad(a, ctrl, b);
        if (obstacles.every((o) => clearance(pts, o) > R_ACTOR + 14)) {
          offset = candidate;
          break;
        }
      }
    }
    // Un montant se lit au milieu de son mouvement ; une relation, plus près de sa source.
    const { d, label } = edgePath(
      pos(edge.source),
      pos(edge.target),
      normal,
      offset,
      radius(edge.source),
      radius(edge.target),
      edge.group === "mouvement" ? 0.5 : 0.4,
    );
    // Deux arêtes parallèles presque verticales : chaque libellé se range du côté de sa courbe.
    const side = count > 1 && Math.abs(normal.x) > 0.6 ? Math.sign(label.x - (p1.x + p2.x) / 2) : 0;
    const color = EDGE_COLORS[edge.group].color;
    const selected = selection?.type === edge.type && selection.id === edge.id;
    const name = `${objectLabel(scenario, edge.source)}, ${edge.text}, ${objectLabel(scenario, edge.target)}`;
    const select = () => onSelect({ type: edge.type, id: edge.id });

    renderedEdges.push(
      <g
        key={edge.key}
        className="scenario-edge cursor-pointer outline-none"
        role="button"
        tabIndex={edge.ended ? -1 : 0}
        aria-label={`${edge.type === "event" ? "Mouvement" : "Relation"} : ${name}${edge.isNew ? " (nouveau)" : ""}`}
        aria-pressed={selected}
        data-relation={edge.type === "relation" ? edge.id : undefined}
        data-event={edge.type === "event" ? edge.id : undefined}
        onClick={select}
        onKeyDown={(e) => activate(e, select)}
        opacity={edge.ended ? 0.45 : 1}
      >
        {edge.isNew ? <path d={d} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={10} /> : null}
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={selected ? 3.5 : edge.group === "titre" ? 1.25 : 2}
          strokeDasharray={edge.ended ? "2 5" : edge.documented ? undefined : "6 4"}
          markerEnd={`url(#arrow-${edge.group})`}
        />
        <path className="edge-focus" d={d} fill="none" stroke="var(--ring)" strokeWidth={6} strokeOpacity={0} />
      </g>,
    );
    // Les relations terminées restent visibles en pointillé, sans libellé, pour ne pas encombrer.
    if (!edge.ended && (edge.group !== "titre" || selected || !edge.documented)) {
      renderedLabels.push(
        <text
          key={`${edge.key}-label`}
          x={label.x + side * 6}
          y={label.y + 4}
          textAnchor={side > 0 ? "start" : side < 0 ? "end" : "middle"}
          fontSize={13}
          fontWeight={selected || edge.isNew ? 600 : 400}
          fill="var(--foreground)"
          stroke="var(--background)"
          strokeWidth={4}
          paintOrder="stroke"
          aria-hidden
          pointerEvents="none"
        >
          {edge.text}
        </text>,
      );
    }
  });

  const groups = new Set(edges.map((e) => e.group));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full min-w-[640px] select-none"
      role="group"
      aria-label={`Graphe du scénario, ${state.objectIds.length} objets, ${state.relations.length} relations et ${state.events.length} opérations visibles`}
      data-groups={[...groups].join(" ")}
    >
      <defs>
        {(Object.keys(EDGE_COLORS) as EdgeGroup[]).map((g) => (
          <marker
            key={g}
            id={`arrow-${g}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,1 L9,5 L0,9 z" fill={EDGE_COLORS[g].color} />
          </marker>
        ))}
      </defs>
      <rect width={W} height={H} fill="transparent" onClick={() => onSelect(null)} aria-hidden />
      {scenario.bands.map((band, k) => {
        // Bandes du graphe à couches : séparateur discret, libellé vertical dans la marge gauche.
        const top = k === 0 ? 0 : (scenario.bands[k - 1].y + band.y) / 2 + 10;
        const bottom = k === scenario.bands.length - 1 ? H : (band.y + scenario.bands[k + 1].y) / 2 + 10;
        const mid = (top + bottom) / 2;
        return (
          <g key={band.label} aria-hidden pointerEvents="none">
            {k > 0 ? <line x1={0} x2={W} y1={top} y2={top} stroke="var(--border)" strokeDasharray="2 6" /> : null}
            <text
              x={16}
              y={mid}
              transform={`rotate(-90 16 ${mid})`}
              textAnchor="middle"
              fontSize={11}
              fill="var(--muted-foreground)"
              letterSpacing={0.5}
            >
              {band.label.toUpperCase()}
            </text>
          </g>
        );
      })}
      <g>{renderedEdges}</g>
      <g>{renderedLabels}</g>
      <g>
        {state.objectIds.map((id) => {
          const o = objectById(scenario, id);
          if (!o) return null;
          const p = pos(id);
          const r = radius(id);
          const isSubject = id === scenario.subjectId;
          const selected = selection?.type === "object" && selection.id === id;
          const label = objectLabel(scenario, id);
          const kind = o.type === "actor" ? ACTOR_KIND_LABELS[o.actor.kind] : RESOURCE_KIND_LABELS[o.resource.kind];
          const Icon =
            (o.type === "actor" ? ACTOR_ICONS[o.actor.kind] : RESOURCE_ICONS[o.resource.kind]) ?? Building2;
          const lines = wrap(label);
          const above = scenario.layout[id]?.label === "above";
          const firstY = above ? p.y - r - 12 - (lines.length - 1) * 16 : p.y + r + 20;
          const labelWidth = Math.max(...lines.map((l) => l.length)) * 8.4 + 10;
          const select = () => onSelect(selected ? null : { type: "object", id });
          return (
            <g
              key={id}
              className="scenario-node cursor-pointer outline-none"
              role="button"
              tabIndex={0}
              aria-label={`${label}, ${kind} : afficher dans l'inspecteur`}
              aria-pressed={selected}
              data-object={id}
              onClick={select}
              onKeyDown={(e) => activate(e, select)}
            >
              <circle className="node-focus" cx={p.x} cy={p.y} r={r + 7} fill="none" stroke="var(--ring)" strokeWidth={3} opacity={selected ? 1 : 0} />
              {o.type === "actor" ? (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="var(--surface-2)"
                  stroke={isSubject ? "var(--teal)" : "var(--border)"}
                  strokeWidth={isSubject ? 3 : 1.5}
                />
              ) : (
                <rect
                  x={p.x - r}
                  y={p.y - r}
                  width={r * 2}
                  height={r * 2}
                  rx={8}
                  fill="var(--surface)"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.25}
                />
              )}
              <Icon x={p.x - 11} y={p.y - 11} width={22} height={22} color="var(--foreground)" aria-hidden />
              {/* Fond du libellé : les arêtes passent dessous au lieu de barrer le texte. */}
              <rect
                x={p.x - labelWidth / 2}
                y={firstY - 14}
                width={labelWidth}
                height={lines.length * 16 + 6}
                rx={4}
                fill="var(--background)"
                aria-hidden
              />
              <text
                x={p.x}
                y={firstY}
                textAnchor="middle"
                fontSize={15}
                fontWeight={isSubject ? 700 : 600}
                fill="var(--foreground)"
                stroke="var(--background)"
                strokeWidth={4}
                paintOrder="stroke"
                aria-hidden
              >
                {lines.map((line, k) => (
                  <tspan key={k} x={p.x} dy={k === 0 ? 0 : 16}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Légende des couleurs et des traits du graphe, limitée aux familles présentes dans le scénario. */
export function GraphLegend({ scenario }: { scenario: Scenario }) {
  const present = new Set<EdgeGroup>(scenario.relations.map((r) => EDGE_GROUP[r.kind]));
  if (scenario.events.some((e) => e.layer !== "interne")) present.add("mouvement");
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Légende du graphe">
      {(Object.keys(EDGE_COLORS) as EdgeGroup[])
        .filter((g) => present.has(g))
        .map((g) => (
          <li key={g} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: EDGE_COLORS[g].color }} aria-hidden />
            {GROUP_LABELS[g] ?? EDGE_COLORS[g].label}
          </li>
        ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dashed border-muted-foreground" aria-hidden />
        Sans fait documenté (allégation, hypothèse)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dotted border-muted-foreground opacity-60" aria-hidden />
        Terminé depuis l'étape précédente
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-5 rounded bg-teal/30" aria-hidden />
        Halo : nouveau à cette étape
      </li>
    </ul>
  );
}
