"use client";

import Link from "next/link";
import { FileSearch, X } from "lucide-react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import { EDGE_LABELS, isHypothesis } from "@/lib/graph/graph-types";
import EvidenceBadge from "./EvidenceBadge";

export default function EdgePanel({
  dto,
  bundle,
}: {
  dto: GraphDTO;
  bundle: CaseBundle;
}) {
  const selectedEdge = useGraphStore((s) => s.selectedEdge);
  const clear = useGraphStore((s) => s.clearSelection);

  if (!selectedEdge) return null;
  const edge = dto.edges.find((e) => e.id === selectedEdge);
  if (!edge) return null;

  const bundleEdge = bundle.edges.find((e) => e.id === selectedEdge);
  const sourceNode = dto.nodes.find((n) => n.id === edge.source);
  const targetNode = dto.nodes.find((n) => n.id === edge.target);

  return (
    <aside className="absolute bottom-4 right-4 top-4 z-30 flex w-80 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          Lien · {EDGE_LABELS[edge.type]}
        </span>
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
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{sourceNode?.label}</span>
          <span className="text-[var(--muted-foreground)]">→</span>
          <span className="font-medium">{targetNode?.label}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {EDGE_LABELS[edge.type]}
          {edge.weight ? ` · ${edge.weight}` : ""}
        </p>
        {bundleEdge?.validFrom || bundleEdge?.validTo ? (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Valide{" "}
            {bundleEdge.validFrom
              ? `du ${new Date(bundleEdge.validFrom).toLocaleDateString("fr-FR")}`
              : "jusqu'au"}
            {bundleEdge.validTo
              ? ` au ${new Date(bundleEdge.validTo).toLocaleDateString("fr-FR")}`
              : bundleEdge.validFrom
                ? " à aujourd'hui"
                : ""}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <EvidenceBadge level={edge.evidenceLevel} />
          <Link
            href={`/cases/${bundle.case.id}/sources?subject=${encodeURIComponent(selectedEdge)}`}
            className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
          >
            <FileSearch size={13} />
            Voir la preuve
          </Link>
        </div>

        {isHypothesis(edge.evidenceLevel) && (
          <p className="mt-3 rounded-lg border border-[var(--amber)]/40 bg-[var(--amber)]/10 p-2.5 text-xs text-[var(--amber)]">
            Ce lien est{" "}
            {edge.evidenceLevel === "simulated" ? "simulé" : "inféré"} : une
            hypothèse d&apos;analyse, pas une preuve.
          </p>
        )}

        {bundleEdge?.excerpt && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Source
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{bundleEdge.excerpt}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
