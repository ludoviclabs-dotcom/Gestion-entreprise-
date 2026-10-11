"use client";

import { Search, X } from "lucide-react";
import { useGraphStore } from "@/lib/store/graph-store";
import type { GraphView, Visibility } from "@/lib/graph/graph-view";
import { searchMatches } from "@/lib/graph/graph-view";

export const GRAPH_SEARCH_ID = "graph-search";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/**
 * Recherche d'entité sur la scène : les nœuds trouvés restent nets, le reste
 * s'estompe. Entrée ouvre la fiche du premier résultat visible ; Échap efface.
 */
export default function GraphSearch({ view, visibility }: { view: GraphView; visibility: Visibility }) {
  const query = useGraphStore((s) => s.query);
  const setQuery = useGraphStore((s) => s.setQuery);
  const selectNode = useGraphStore((s) => s.selectNode);
  const setViewMode = useGraphStore((s) => s.setViewMode);

  const q = query.trim();
  const matches = searchMatches(view, q);
  const visible = view.nodes.filter((n) => matches.has(n.id) && visibility.nodes.has(n.id));
  const hidden = matches.size - visible.length;
  const hint = !q
    ? "Survoler : niveau de preuve · Cliquer : fiche · Glisser : déplacer · T : table"
    : visible.length
      ? `${plural(visible.length, "résultat")} · Entrée : ouvrir la première fiche`
      : hidden
        ? `${plural(hidden, "résultat")} ${hidden > 1 ? "masqués" : "masqué"} par le curseur temporel ou les couches`
        : "Aucune entité ne correspond";

  return (
    <div className="absolute left-4 right-4 top-16 z-[var(--z-sticky)] flex flex-col gap-2 sm:left-8 lg:right-auto lg:top-5 lg:w-[300px]">
      <label className="flex items-center gap-2.5 border-b border-control bg-background/70 pb-[7px] transition-ui focus-within:border-primary">
        <Search size={14} aria-hidden className="flex-none text-subtle" />
        <input
          id={GRAPH_SEARCH_ID}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && visible[0]) {
              setViewMode("graph");
              selectNode(visible[0].id);
            } else if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
          placeholder="Rechercher une entité, un dirigeant, une adresse…"
          aria-label="Rechercher une entité dans le graphe"
          aria-describedby={`${GRAPH_SEARCH_ID}-hint`}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent p-0 font-mono text-xs text-foreground placeholder:text-subtle focus-visible:outline-none"
        />
        {q ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => setQuery("")}
            className="inline-flex text-subtle transition-ui hover:text-foreground"
          >
            <X size={13} aria-hidden />
          </button>
        ) : null}
      </label>
      <div id={`${GRAPH_SEARCH_ID}-hint`} aria-live="polite" className="font-mono text-micro leading-normal text-subtle">
        {hint}
      </div>
    </div>
  );
}
