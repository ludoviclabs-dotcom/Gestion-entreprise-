"use client";

import { GitBranch, X } from "lucide-react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { CaseBundle } from "@/lib/graph/graph-types";

/**
 * Bandeau flottant qui résume le chemin trouvé entre deux entités. Apparaît
 * uniquement quand `path` est défini dans le store. Le clic sur la croix
 * efface la mise en évidence (sans toucher à la sélection courante).
 */
export default function PathBanner({ bundle }: { bundle: CaseBundle }) {
  const path = useGraphStore((s) => s.path);
  const clearPath = useGraphStore((s) => s.clearPath);
  if (!path) return null;

  const labelOf = (id: string) =>
    bundle.entities.find((e) => e.id === id)?.label ?? id;
  const sourceLabel = labelOf(path.source);
  const targetLabel = labelOf(path.target);

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute left-1/2 top-4 z-30 flex max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/40 bg-surface/95 px-4 py-2 text-xs backdrop-blur"
    >
      <GitBranch size={14} className="text-primary" />
      <span className="text-foreground">
        <strong className="font-medium">{sourceLabel}</strong> →{" "}
        <strong className="font-medium">{targetLabel}</strong>{" "}
        <span className="text-muted-foreground">
          ({path.nodes.length - 1} liens)
        </span>
      </span>
      <button
        type="button"
        onClick={clearPath}
        className="text-muted-foreground transition hover:text-foreground"
        aria-label="Effacer le chemin"
      >
        <X size={14} />
      </button>
    </div>
  );
}
