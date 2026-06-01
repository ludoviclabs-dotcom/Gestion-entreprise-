"use client";

import { X } from "lucide-react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import {
  NODE_COLORS,
  NODE_LABELS,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
} from "@/lib/graph/graph-types";
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

  if (!selectedNode) return null;
  const node = dto.nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  const entity = bundle.entities.find((e) => e.id === selectedNode);
  const event = bundle.events.find((e) => e.id === selectedNode);
  const signals = bundle.riskSignals.filter((r) => r.subjectId === selectedNode);
  const attrs = entity?.attributes ?? {};
  const excerpt = entity?.excerpt ?? event?.source;

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
