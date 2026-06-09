"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Network, Search } from "lucide-react";
import Sidebar from "./mockup/Sidebar.client";
import MockupPanel from "./mockup/MockupPanel.client";
import type { Section, Tab } from "./mockup/mock-data";

/**
 * Orchestrateur du mockup produit (hero landing). Détient l'état d'interaction
 * — section (sidebar), onglet (dossier), nœud sélectionné — et compose la
 * barre de titre app + recherche ⌘K + (sidebar | panneau de section).
 * Les sous-composants sont contrôlés ; cet orchestrateur reste mince.
 */
export default function ProductPanel() {
  const [section, setSection] = useState<Section>("dossiers");
  const [tab, setTab] = useState<Tab>("Graphe");
  const [selected, setSelected] = useState("holding");

  return (
    <motion.div
      data-qa="product-panel"
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="relative z-[2] overflow-hidden rounded-[18px] border border-[var(--kyb-line)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
      style={{
        background: "linear-gradient(160deg, var(--kyb-bg1), var(--kyb-bg2))",
      }}
    >
      {/* barre de titre (niveau application) */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--kyb-line)] px-3.5 py-[11px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--kyb-violet), var(--kyb-violet-soft))",
            }}
          >
            <Network size={12} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-[var(--kyb-text-hi)]">
              KYB Graph
            </div>
            <div className="truncate text-[10px] text-[var(--kyb-text-low)]">
              Espace de conformité — démonstration
            </div>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--kyb-line)] px-2 py-[3px] text-[10px] text-[var(--kyb-green)]">
          <span
            className="kyb-pulse h-[5px] w-[5px] rounded-full"
            style={{ color: "var(--kyb-green)", backgroundColor: "var(--kyb-green)" }}
          />
          Mode live
        </span>
      </div>

      {/* barre de recherche (style ⌘K, visuelle) */}
      <div className="border-b border-[var(--kyb-line)] px-3.5 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--kyb-line)] bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] text-[var(--kyb-text-low)]">
          <Search size={13} />
          <span className="flex-1 truncate">
            Rechercher une entité, un dirigeant, une adresse…
          </span>
          <span className="rounded border border-[var(--kyb-line)] bg-white/[0.05] px-1.5 py-px text-[10px]">
            ⌘K
          </span>
        </div>
      </div>

      {/* corps : navigation latérale + panneau de section */}
      <div className="flex flex-col sm:flex-row">
        <Sidebar active={section} onSelect={setSection} />
        <div className="min-w-0 flex-1">
          <MockupPanel
            section={section}
            tab={tab}
            onTabChange={setTab}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      </div>
    </motion.div>
  );
}
