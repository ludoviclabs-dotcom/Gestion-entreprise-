"use client";

import { Grid2X2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import MockupGraph from "./MockupGraph.client";
import ScoreRing from "../ScoreRing.client";
import { ENTITY_SUMMARIES } from "./mock-data";
import { NODE_FILL, NODE_TYPE_LABEL, type MockNodeType } from "./graph-data";

const LEGEND: MockNodeType[] = [
  "company",
  "person",
  "source",
  "address",
  "risk",
  "foreign",
];

/**
 * Onglet « Graphe » : le mini-graphe interactif + toolbar flottante + légende,
 * et la carte de synthèse de l'entité sélectionnée (réagit au clic sur un nœud).
 */
export default function GraphTab({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const ent = ENTITY_SUMMARIES[selected] ?? ENTITY_SUMMARIES.holding;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-[196px] flex-1">
        {/* toolbar flottante (visuelle) */}
        <div
          className="absolute right-2.5 top-2.5 z-[3] hidden flex-col gap-1 rounded-lg border border-[var(--kyb-line)] p-1 backdrop-blur-md sm:flex"
          style={{ background: "rgba(14,16,32,0.7)" }}
        >
          {[ZoomIn, ZoomOut, Maximize2, Grid2X2].map((Icon, i) => (
            <button
              key={i}
              type="button"
              aria-label="Contrôle du graphe (démonstration)"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--kyb-text-mid)] transition-colors hover:bg-[rgba(124,92,255,0.15)] hover:text-[var(--kyb-text-hi)]"
            >
              <Icon size={13} />
            </button>
          ))}
        </div>

        <MockupGraph selected={selected} onSelect={onSelect} />
      </div>

      {/* légende (bande sous le graphe, ne chevauche aucun libellé) */}
      <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--kyb-line)] px-3 py-1.5 sm:flex">
        {LEGEND.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-[9.5px] text-[var(--kyb-text-mid)]"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: NODE_FILL[t] }}
            />
            {NODE_TYPE_LABEL[t]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[9.5px] text-[var(--kyb-text-low)]">
          <span className="inline-block h-px w-3.5 border-t border-dashed border-[var(--kyb-text-mid)]" />
          à vérifier
        </span>
      </div>

      {/* carte de synthèse de l'entité sélectionnée */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--kyb-line)] bg-white/[0.015] px-3 py-2.5">
        <ScoreRing score={ent.score} size={56} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold text-[var(--kyb-text-hi)]">
              {ent.label}
            </span>
            <span className="rounded-full border border-[var(--kyb-line)] px-2 py-px text-[10px] text-[var(--kyb-text-low)]">
              {ent.type}
            </span>
          </div>
          <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--kyb-text-mid)]">
            <span>SIREN {ent.siren}</span>
            <span>Statut : {ent.statut}</span>
            <span>Pays : {ent.pays}</span>
            <span>{ent.links} lien(s)</span>
          </div>
          <p className="text-[11px] leading-snug text-[var(--kyb-text-mid)]">
            {ent.resume}
          </p>
        </div>
      </div>
    </div>
  );
}
