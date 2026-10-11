"use client";

import { useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useGraphStore } from "@/lib/store/graph-store";
import type { CaseRiskSignal } from "@/lib/graph/graph-types";
import {
  EDGE_LABELS,
  EVIDENCE_LABELS,
  NODE_LABELS,
  RULE_FAMILY_LABELS,
  SEVERITY_LABELS,
  familyForRule,
  isHypothesis,
} from "@/lib/graph/graph-types";
import type { GraphView, ViewEdge, ViewNode } from "@/lib/graph/graph-view";
import { sinceOf, structuralLinks } from "@/lib/graph/graph-view";
import { SEVERITY_TONE } from "@/lib/design/domain-tones";
import { TONE_STYLES } from "@/lib/design/tone";
import { formatDateFr } from "@/lib/format-date";
import { findPathAction } from "@/app/(app)/cases/actions";
import { proofSwatchStyle } from "./proof-style";

const CAPS = "font-mono text-micro uppercase tracking-[0.1em] text-subtle";
const TEXT_BUTTON = "font-medium text-muted-foreground transition-ui hover:text-foreground disabled:opacity-50";

function validity(e: ViewEdge): string {
  if (!e.from && !e.to) return "";
  if (!e.from) return `jusqu'au ${formatDateFr(e.to)}`;
  return `du ${formatDateFr(e.from)}${e.to ? ` au ${formatDateFr(e.to)}` : " à aujourd'hui"}`;
}

/**
 * Fiche latérale (non modale) d'une entité ou d'un lien : niveau de preuve,
 * attributs, signaux, source, accès à la preuve et recherche de chemin.
 */
export default function GraphFiche({
  view,
  caseId,
  signals,
}: {
  view: GraphView;
  caseId: string;
  signals: CaseRiskSignal[];
}) {
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectedEdge = useGraphStore((s) => s.selectedEdge);
  const clear = useGraphStore((s) => s.clearSelection);
  const viewMode = useGraphStore((s) => s.viewMode);

  const node = selectedNode ? view.byId[selectedNode] : undefined;
  const edge = selectedEdge ? view.edges.find((e) => e.id === selectedEdge) : undefined;
  if (viewMode === "table" || (!node && !edge)) return null;

  const subject = node?.id ?? edge!.id;
  const center = () => window.dispatchEvent(new CustomEvent("kyb:graph-camera", { detail: "selection" }));

  return (
    <aside
      aria-label={node ? `Fiche : ${node.label}` : "Fiche du lien"}
      className="motion-enter motion-from-right absolute inset-y-0 right-0 z-[var(--z-floating)] w-full overflow-y-auto border-l border-border bg-background/95 px-7 pb-7 pt-[22px] sm:w-[340px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`${CAPS} pt-1`}>
          {node ? `Fiche · ${NODE_LABELS[node.kind]}` : `Lien · ${EDGE_LABELS[edge!.type]}`}
        </div>
        <button
          type="button"
          aria-label="Fermer la fiche"
          onClick={clear}
          className="-mr-1 -mt-1 inline-flex p-1 text-subtle transition-ui hover:text-foreground"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {node ? (
        <NodeBody view={view} node={node} signals={signals.filter((s) => s.subjectId === node.id)} />
      ) : (
        <EdgeBody view={view} edge={edge!} />
      )}

      <div className="mt-[22px] flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
        <Link
          href={`/cases/${caseId}/sources?subject=${encodeURIComponent(subject)}`}
          className="inline-flex gap-1.5 text-primary transition-ui hover:text-foreground"
        >
          <span>Voir la preuve</span>
          <span aria-hidden>↗</span>
        </Link>
        <button type="button" onClick={center} className={TEXT_BUTTON}>
          Recentrer
        </button>
      </div>

      {node && (node.kind === "company" || node.kind === "person") ? (
        <PathActions view={view} caseId={caseId} nodeId={node.id} />
      ) : null}
    </aside>
  );
}

function ProofLine({ evidence, meta }: { evidence: ViewNode["evidence"]; meta?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
      <span style={proofSwatchStyle(evidence)} />
      <span>{EVIDENCE_LABELS[evidence]}</span>
      {isHypothesis(evidence) ? <span className="text-tone-vigilance">· à vérifier</span> : null}
      {meta ? <span className="text-subtle">· {meta}</span> : null}
    </div>
  );
}

function Attrs({ rows }: { rows: { k: string; v: string }[] }) {
  if (!rows.length) return null;
  return (
    <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-[7px] font-mono text-xs">
      {rows.map(({ k, v }) => (
        <div key={k} className="contents">
          <dt className="text-subtle">{k}</dt>
          <dd className="m-0 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function NodeBody({ view, node, signals }: { view: GraphView; node: ViewNode; signals: CaseRiskSignal[] }) {
  const links = structuralLinks(view, node.id).length;
  const events = view.nodes.filter((n) => n.kind === "event").length;
  const since = sinceOf(view, node.id);
  const meta =
    node.kind === "event"
      ? undefined
      : `${links} lien${links > 1 ? "s" : ""}` + (node.main && events ? ` · ${events} événements` : "");
  const rows = [
    ...Object.entries(node.attrs).map(([k, v]) => ({ k, v })),
    ...(node.kind !== "event" ? [{ k: "Depuis", v: since ? formatDateFr(since) : "—" }] : []),
  ];
  return (
    <>
      <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-0.015em] [text-wrap:pretty]">{node.label}</h2>
      <ProofLine evidence={node.evidence} meta={meta} />
      <Attrs rows={rows} />

      {signals.length ? (
        <>
          <div className={`${CAPS} mt-6`}>Signaux ({signals.length})</div>
          {signals.map((s) => (
            <div key={s.id} className="mt-2 border-t border-border py-2.5">
              <div className={`font-mono text-micro ${TONE_STYLES[SEVERITY_TONE[s.severity]].text}`}>
                {SEVERITY_LABELS[s.severity]} · {RULE_FAMILY_LABELS[familyForRule(s.ruleId)]}
              </div>
              <p className="mt-1 text-sm leading-normal text-muted-foreground [text-wrap:pretty]">{s.explanation}</p>
            </div>
          ))}
        </>
      ) : null}

      <div className={`${CAPS} mt-6`}>Source</div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground [text-wrap:pretty]">{node.source ?? "Source non précisée."}</p>
      {node.excerpt ? (
        <p className="mt-2 border-l border-control pl-3 text-sm leading-relaxed text-muted-foreground [text-wrap:pretty]">
          {node.excerpt}
        </p>
      ) : null}
    </>
  );
}

function EdgeBody({ view, edge }: { view: GraphView; edge: ViewEdge }) {
  const a = view.byId[edge.source];
  const b = view.byId[edge.target];
  const valid = validity(edge);
  const nature = EDGE_LABELS[edge.type] + (edge.label && edge.label !== EDGE_LABELS[edge.type] ? ` — ${edge.label}` : "");
  const rows = [
    { k: "Nature", v: nature },
    { k: "De", v: a.label },
    { k: "Vers", v: b.label },
    ...(valid ? [{ k: "Valide", v: valid }] : []),
  ];
  return (
    <>
      <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-0.015em] [text-wrap:pretty]">
        {a.label} → {b.label}
      </h2>
      <ProofLine evidence={edge.evidence} meta={[edge.weight, valid].filter(Boolean).join(" · ") || undefined} />
      {isHypothesis(edge.evidence) ? (
        <p className="mt-4 rounded-sm border border-dashed border-tone-vigilance px-3 py-2.5 text-sm leading-normal text-muted-foreground">
          Ce lien est{" "}
          <strong className="font-semibold text-tone-vigilance">{EVIDENCE_LABELS[edge.evidence].toLowerCase()}</strong> : une
          hypothèse d&apos;analyse, pas une preuve.
        </p>
      ) : null}
      <Attrs rows={rows} />
      <div className={`${CAPS} mt-6`}>Source</div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground [text-wrap:pretty]">
        {edge.excerpt ?? edge.sourceLabel ?? "Source non précisée."}
      </p>
    </>
  );
}

/** Plus court chemin de preuve entre deux entités (action serveur existante). */
function PathActions({ view, caseId, nodeId }: { view: GraphView; caseId: string; nodeId: string }) {
  const pathSource = useGraphStore((s) => s.pathSource);
  const setPathSource = useGraphStore((s) => s.setPathSource);
  const setPath = useGraphStore((s) => s.setPath);
  const clearPath = useGraphStore((s) => s.clearPath);
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!pathSource) return;
    const source = pathSource;
    startTransition(async () => {
      const res = await findPathAction(caseId, source, nodeId);
      if (res.ok) {
        setPath({ source, target: nodeId, nodes: res.nodes });
        toast.success("Chemin trouvé", {
          description: `${res.nodes.length - 1} liens entre ${view.byId[source]?.label ?? source} et ${view.byId[nodeId]?.label ?? nodeId}.`,
        });
      } else {
        toast.error(res.error);
        setPath(null);
      }
    });
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className={CAPS}>Chemin de preuve</div>
      {!pathSource ? (
        <button type="button" onClick={() => setPathSource(nodeId)} className={`${TEXT_BUTTON} mt-2 text-sm`}>
          Tracer un chemin depuis cette entité
        </button>
      ) : pathSource === nodeId ? (
        <p className="mt-2 text-sm leading-normal text-muted-foreground">
          Origine du chemin choisie. Ouvrez une autre entité puis « Chemin vers cette entité ».{" "}
          <button type="button" onClick={clearPath} className={TEXT_BUTTON}>
            Annuler
          </button>
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <button type="button" disabled={pending} onClick={run} className="font-medium text-primary transition-ui hover:text-foreground disabled:opacity-50">
            {pending ? "Recherche du chemin…" : "Chemin vers cette entité →"}
          </button>
          <button type="button" onClick={clearPath} className={TEXT_BUTTON}>
            Annuler le chemin
          </button>
        </div>
      )}
    </div>
  );
}
