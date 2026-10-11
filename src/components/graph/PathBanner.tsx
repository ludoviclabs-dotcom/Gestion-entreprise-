"use client";

import { X } from "lucide-react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { GraphView } from "@/lib/graph/graph-view";

/**
 * Bandeau du chemin trouvé entre deux entités. Apparaît quand `path` est défini ;
 * la croix efface la mise en évidence (sans toucher à la sélection courante).
 */
export default function PathBanner({ view }: { view: GraphView }) {
  const path = useGraphStore((s) => s.path);
  const clearPath = useGraphStore((s) => s.clearPath);
  if (!path) return null;

  const labelOf = (id: string) => view.byId[id]?.label ?? id;
  const links = path.nodes.length - 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className="motion-reveal absolute left-1/2 top-28 z-[var(--z-sticky)] flex max-w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-sm border-l-2 border-primary bg-surface-3 px-3 py-2 font-mono text-xs shadow-lg lg:top-5"
    >
      <span className="min-w-0 truncate">
        <span className="text-subtle">Chemin · </span>
        <span className="text-foreground">{labelOf(path.source)}</span>
        <span className="text-subtle"> → </span>
        <span className="text-foreground">{labelOf(path.target)}</span>
        <span className="text-subtle">
          {" "}
          ({links} lien{links > 1 ? "s" : ""})
        </span>
      </span>
      <button
        type="button"
        onClick={clearPath}
        aria-label="Effacer le chemin"
        className="inline-flex flex-none text-subtle transition-ui hover:text-foreground"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}
