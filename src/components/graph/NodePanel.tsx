"use client";

import { useTransition } from "react";
import { X, GitBranch, Crosshair, Eraser, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGraphStore } from "@/lib/store/graph-store";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import {
  NODE_COLORS,
  NODE_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
} from "@/lib/graph/graph-types";
import { findPathAction } from "@/app/(app)/cases/actions";
import EvidenceBadge from "./EvidenceBadge";

export default function NodePanel({
  dto,
  bundle,
}: {
  dto: GraphDTO;
  bundle: CaseBundle;
}) {
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const clear = useGraphStore((s) => s.clearSelection);
  const pathSource = useGraphStore((s) => s.pathSource);
  const setPathSource = useGraphStore((s) => s.setPathSource);
  const setPath = useGraphStore((s) => s.setPath);
  const clearPath = useGraphStore((s) => s.clearPath);
  const [pending, startTransition] = useTransition();

  if (!selectedNode) return null;
  const node = dto.nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  const entity = bundle.entities.find((e) => e.id === selectedNode);
  const event = bundle.events.find((e) => e.id === selectedNode);
  const signals = bundle.riskSignals.filter((r) => r.subjectId === selectedNode);
  const attrs = entity?.attributes ?? {};
  const excerpt = entity?.excerpt ?? event?.source;

  const runPathFinding = (targetId: string) => {
    if (!pathSource) return;
    startTransition(async () => {
      const res = await findPathAction(bundle.case.id, pathSource, targetId);
      if (res.ok) {
        setPath({ source: pathSource, target: targetId, nodes: res.nodes });
        const sourceLabel =
          bundle.entities.find((e) => e.id === pathSource)?.label ?? pathSource;
        const targetLabel =
          bundle.entities.find((e) => e.id === targetId)?.label ?? targetId;
        toast.success("Chemin trouvé", {
          description: `${res.nodes.length - 1} liens entre ${sourceLabel} et ${targetLabel}.`,
        });
      } else {
        toast.error(res.error);
        setPath(null);
      }
    });
  };

  return (
    <aside className="absolute bottom-4 right-4 top-4 z-30 flex w-80 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: NODE_COLORS[node.kind] }}
          />
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            {NODE_LABELS[node.kind]}
          </span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold">
          {node.label}
        </h2>
        <div className="mt-2">
          <EvidenceBadge level={node.evidenceLevel} />
        </div>

        {/* Actions path-finding (nœuds société/personne uniquement). */}
        {(node.kind === "company" || node.kind === "person") && (
          <div className="mt-4 space-y-1.5">
            {!pathSource && (
              <button
                type="button"
                onClick={() => setPathSource(selectedNode)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs transition hover:border-primary/50"
              >
                <Crosshair size={14} className="text-primary" />
                Tracer un chemin depuis ce nœud
              </button>
            )}
            {pathSource && pathSource !== selectedNode && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => runPathFinding(selectedNode)}
                  className="flex w-full items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-xs text-foreground transition hover:bg-primary/20 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <GitBranch size={14} className="text-primary" />
                  )}
                  Chemin vers ce nœud
                </button>
                <button
                  type="button"
                  onClick={clearPath}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <Eraser size={14} />
                  Annuler le chemin
                </button>
              </>
            )}
            {pathSource === selectedNode && (
              <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
                Origine du chemin sélectionnée. Clique un autre nœud puis « Chemin vers ce nœud ».
              </p>
            )}
          </div>
        )}

        {Object.keys(attrs).length > 0 && (
          <dl className="mt-4 space-y-1.5">
            {Object.entries(attrs).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-xs">
                <dt className="text-[var(--muted-foreground)]">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {signals.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Signaux
            </p>
            <ul className="space-y-2">
              {signals.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `${SEVERITY_COLORS[s.severity]}22`,
                        color: SEVERITY_COLORS[s.severity],
                      }}
                    >
                      {SEVERITY_LABELS[s.severity]}
                    </span>
                    <span className="text-[10px] uppercase text-[var(--muted-foreground)]">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-xs">{s.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {excerpt && (
          <div className="mt-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Source
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{excerpt}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
