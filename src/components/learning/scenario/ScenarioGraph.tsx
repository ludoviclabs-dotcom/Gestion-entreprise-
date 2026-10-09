import type { KeyboardEvent, ReactNode } from "react";
import {
  Banknote,
  Briefcase,
  Building2,
  Code,
  Database,
  FileBadge,
  FlaskConical,
  FolderLock,
  Handshake,
  Landmark,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Relation, RelationKind, Scenario } from "@/lib/learning/schema";
import {
  knownClaimsOf,
  objectById,
  objectLabel,
  relationShortLabel,
  type ScenarioState,
  type StateDiff,
} from "@/lib/learning/projections";
import { ACTOR_KIND_LABELS, RESOURCE_KIND_LABELS } from "@/lib/learning/labels";

export type Selection = { type: "object"; id: string } | { type: "relation"; id: string } | null;

const W = 1000;
const H = 640;
const R_ACTOR = 28;
const R_SUBJECT = 36;
const R_RESOURCE = 24;

type EdgeGroup = "capital" | "titre" | "commercial" | "financier" | "technique";

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

/** Couleurs neutres : aucune ne signifie « menace ». La légende et les libellés doublent la couleur. */
export const EDGE_COLORS: Record<EdgeGroup, { color: string; label: string }> = {
  capital: { color: "#0ea5a3", label: "Capital, votes, direction" },
  titre: { color: "#94a3b8", label: "Titularité d'un actif" },
  commercial: { color: "#3b82f6", label: "Client, licence" },
  financier: { color: "#a855f7", label: "Prêt, sûreté" },
  technique: { color: "#65a30d", label: "Prestation, accès" },
};

const ACTOR_ICONS: Record<string, LucideIcon> = {
  entreprise: Building2,
  personne: User,
  investisseur: Briefcase,
  preteur: Banknote,
  banque: Landmark,
  client: Handshake,
  prestataire_technique: Wrench,
};

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  brevet: FileBadge,
  logiciel: Code,
  donnees: Database,
  procede: FlaskConical,
  systeme: FolderLock,
};

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
function edgePath(a: Pt, b: Pt, normal: Pt, offset: number, rA: number, rB: number) {
  const ctrl = { x: (a.x + b.x) / 2 + normal.x * offset * 2, y: (a.y + b.y) / 2 + normal.y * offset * 2 };
  const s = toward(a, ctrl, rA + 2);
  const e = toward(b, ctrl, rB + 6);
  const t = 0.4;
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

  const ended = diff.endedRelationIds
    .map((id) => scenario.relations.find((r) => r.id === id))
    .filter((r): r is Relation => !!r && visible.has(r.source) && visible.has(r.target));
  const edges: { relation: Relation; ended: boolean }[] = [
    ...ended.map((relation) => ({ relation, ended: true })),
    ...state.relations.map((relation) => ({ relation, ended: false })),
  ];

  // Regroupe les relations par paire d'objets pour les écarter les unes des autres.
  const pairs = new Map<string, number>();
  const pairIndex = edges.map(({ relation: r }) => {
    const key = [r.source, r.target].sort().join("|");
    const i = pairs.get(key) ?? 0;
    pairs.set(key, i + 1);
    return { key, i };
  });

  const renderedEdges: ReactNode[] = [];
  const renderedLabels: ReactNode[] = [];
  edges.forEach(({ relation: r, ended: isEnded }, n) => {
    const { key, i } = pairIndex[n];
    const count = pairs.get(key) ?? 1;
    const [first, second] = key.split("|");
    const p1 = pos(first);
    const p2 = pos(second);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const normal = { x: -(p2.y - p1.y) / len, y: (p2.x - p1.x) / len };
    const offset = (i - (count - 1) / 2) * 30;
    const { d, label } = edgePath(pos(r.source), pos(r.target), normal, offset, radius(r.source), radius(r.target));
    const group = EDGE_GROUP[r.kind];
    const color = EDGE_COLORS[group].color;
    const claims = knownClaimsOf(scenario, state, r);
    const documented = claims.some((c) => c.nature === "fait_documente");
    const selected = selection?.type === "relation" && selection.id === r.id;
    const isNew = !isEnded && added.has(r.id);
    const text = isEnded ? `terminé : ${relationShortLabel(r)}` : relationShortLabel(r);
    const name = `${objectLabel(scenario, r.source)}, ${text}, ${objectLabel(scenario, r.target)}`;
    const select = () => onSelect({ type: "relation", id: r.id });

    renderedEdges.push(
      <g
        key={`${r.id}${isEnded ? "-fin" : ""}`}
        className="scenario-edge cursor-pointer outline-none"
        role="button"
        tabIndex={isEnded ? -1 : 0}
        aria-label={`Relation : ${name}${isNew ? " (nouveau)" : ""}`}
        aria-pressed={selected}
        data-relation={r.id}
        onClick={select}
        onKeyDown={(e) => activate(e, select)}
        opacity={isEnded ? 0.45 : 1}
      >
        {isNew ? <path d={d} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth={10} /> : null}
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={selected ? 3.5 : group === "titre" ? 1.25 : 2}
          strokeDasharray={isEnded ? "2 5" : documented ? undefined : "6 4"}
          markerEnd={`url(#arrow-${group})`}
        />
        <path className="edge-focus" d={d} fill="none" stroke="var(--ring)" strokeWidth={6} strokeOpacity={0} />
      </g>,
    );
    // Les relations terminées restent visibles en pointillé, sans libellé, pour ne pas encombrer.
    if (!isEnded && (group !== "titre" || selected)) {
      renderedLabels.push(
        <text
          key={`${r.id}-label${isEnded ? "-fin" : ""}`}
          x={label.x}
          y={label.y + 4}
          textAnchor="middle"
          fontSize={13}
          fontWeight={selected || isNew ? 600 : 400}
          fill="var(--foreground)"
          stroke="var(--background)"
          strokeWidth={4}
          paintOrder="stroke"
          aria-hidden
          pointerEvents="none"
        >
          {text}
        </text>,
      );
    }
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full min-w-[640px] select-none"
      role="group"
      aria-label={`Graphe du scénario, ${state.objectIds.length} objets et ${state.relations.length} relations visibles`}
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
      <rect
        width={W}
        height={H}
        fill="transparent"
        onClick={() => onSelect(null)}
        aria-hidden
      />
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

/** Légende des couleurs et des traits du graphe. */
export function GraphLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Légende du graphe">
      {Object.values(EDGE_COLORS).map((g) => (
        <li key={g.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded" style={{ background: g.color }} aria-hidden />
          {g.label}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dashed border-muted-foreground" aria-hidden />
        Sans fait documenté
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
