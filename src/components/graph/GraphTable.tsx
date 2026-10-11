"use client";

import type { KeyboardEvent } from "react";
import { useGraphStore } from "@/lib/store/graph-store";
import { EDGE_LABELS, EVIDENCE_LABELS, NODE_LABELS } from "@/lib/graph/graph-types";
import type { GraphView, Visibility } from "@/lib/graph/graph-view";
import { searchMatches, sinceOf, structuralLinks } from "@/lib/graph/graph-view";
import { formatDateFr } from "@/lib/format-date";
import { proofSwatchStyle } from "./proof-style";

const TH = "border-b border-foreground pb-2.5 pr-4 text-left font-mono text-micro font-normal uppercase tracking-[0.1em] text-subtle";
const TD = "border-b border-border py-3 pr-4";
const MONO = "font-mono text-xs text-muted-foreground";
const ROW = "cursor-pointer transition-ui hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

function activate(run: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      run();
    }
  };
}

/**
 * Vue table du graphe — équivalent textuel accessible (touche T). Mêmes filtres
 * que la scène (couches, curseur temporel, recherche) ; une ligne ouvre la fiche
 * correspondante sur le graphe.
 */
export default function GraphTable({ view, visibility }: { view: GraphView; visibility: Visibility }) {
  const query = useGraphStore((s) => s.query);
  const showEvents = useGraphStore((s) => s.layers.evenements);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const setViewMode = useGraphStore((s) => s.setViewMode);

  const q = query.trim();
  const matches = searchMatches(view, q);
  const keep = (id: string) => !q || matches.has(id);

  const rows = view.nodes
    .filter((n) => visibility.nodes.has(n.id) && (n.kind !== "event" || showEvents) && keep(n.id))
    .sort(
      (a, b) =>
        Number(b.main) - Number(a.main) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label, "fr"),
    );
  const links = view.edges
    .filter((e) => e.type !== "A_PUBLIE" && visibility.edges.has(e.id) && (keep(e.source) || keep(e.target)))
    .sort((a, b) => a.type.localeCompare(b.type) || view.byId[a.source].label.localeCompare(view.byId[b.source].label, "fr"));

  const openNode = (id: string) => {
    selectNode(id);
    setViewMode("graph");
  };
  const openEdge = (id: string) => {
    selectEdge(id);
    setViewMode("graph");
  };

  return (
    <div
      role="region"
      aria-label="Vue table du graphe"
      className="motion-reveal absolute inset-0 z-[var(--z-raised)] overflow-auto bg-background px-4 pb-6 pt-32 sm:px-8 lg:pt-[92px]"
    >
      <table className="w-full border-collapse text-sm">
        <caption className="pb-3 text-left font-mono text-micro uppercase tracking-[0.1em] text-subtle">
          Entités ({rows.length})
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>Entité</th>
            <th scope="col" className={TH}>Type</th>
            <th scope="col" className={TH}>Preuve</th>
            <th scope="col" className={`${TH} text-right`}>Liens</th>
            <th scope="col" className={TH}>Depuis</th>
            <th scope="col" className={`${TH} pr-0`}>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => {
            const since = n.kind === "event" ? n.date : sinceOf(view, n.id);
            return (
              <tr key={n.id} tabIndex={0} className={ROW} onClick={() => openNode(n.id)} onKeyDown={activate(() => openNode(n.id))}>
                <td className={`${TD} font-medium`}>{n.label}</td>
                <td className={`${TD} ${MONO}`}>{NODE_LABELS[n.kind]}</td>
                <td className={`${TD} ${MONO}`}>
                  <span className="inline-flex items-center gap-2">
                    <span style={proofSwatchStyle(n.evidence)} />
                    <span>{EVIDENCE_LABELS[n.evidence]}</span>
                  </span>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{n.kind === "event" ? 1 : structuralLinks(view, n.id).length}</td>
                <td className={`${TD} ${MONO}`}>{since ? formatDateFr(since) : "—"}</td>
                <td className={`${TD} pr-0 text-muted-foreground`}>{n.source ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {links.length ? (
        <table className="mt-10 w-full border-collapse text-sm">
          <caption className="pb-3 text-left font-mono text-micro uppercase tracking-[0.1em] text-subtle">
            Liens ({links.length})
          </caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>De</th>
              <th scope="col" className={TH}>Nature</th>
              <th scope="col" className={TH}>Vers</th>
              <th scope="col" className={TH}>Preuve</th>
              <th scope="col" className={`${TH} pr-0`}>Valide</th>
            </tr>
          </thead>
          <tbody>
            {links.map((e) => (
              <tr key={e.id} tabIndex={0} className={ROW} onClick={() => openEdge(e.id)} onKeyDown={activate(() => openEdge(e.id))}>
                <td className={`${TD} font-medium`}>{view.byId[e.source].label}</td>
                <td className={`${TD} ${MONO}`}>{e.label ?? EDGE_LABELS[e.type]}</td>
                <td className={`${TD} font-medium`}>{view.byId[e.target].label}</td>
                <td className={`${TD} ${MONO}`}>
                  <span className="inline-flex items-center gap-2">
                    <span style={proofSwatchStyle(e.evidence)} />
                    <span>{EVIDENCE_LABELS[e.evidence]}</span>
                  </span>
                </td>
                <td className={`${TD} pr-0 ${MONO}`}>
                  {e.from ? `depuis le ${formatDateFr(e.from)}` : "—"}
                  {e.to ? ` · fin le ${formatDateFr(e.to)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
