"use client";

import type { Section, Tab } from "./mock-data";
import MockupTabs from "./MockupTabs.client";
import DashboardPanel from "./DashboardPanel";
import AnalysesPanel from "./AnalysesPanel";
import AlertsPanel from "./AlertsPanel";
import GlobalSourcesPanel from "./GlobalSourcesPanel";
import SettingsPanel from "./SettingsPanel";

/**
 * Routeur de section. « Dossiers » affiche l'en-tête du dossier + les onglets
 * internes ; les autres sections affichent un panneau dédié (onglets masqués).
 * `min-h` constant → pas de saut de hauteur au changement de section.
 */
export default function MockupPanel({
  section,
  tab,
  onTabChange,
  selected,
  onSelect,
}: {
  section: Section;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (section === "dossiers") {
    return (
      <div className="flex h-full min-h-[320px] flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--kyb-line)] px-3.5 py-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-[var(--kyb-text-hi)]">
              Holding Patrimoniale — démonstration
            </div>
            <div className="truncate text-[10px] text-[var(--kyb-text-low)]">
              SIREN 900 111 222 · 7 entités · 9 liens
            </div>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[var(--kyb-line)] px-2 py-[3px] text-[10px] text-[var(--kyb-green)] sm:inline-flex">
            <span
              className="kyb-pulse h-[5px] w-[5px] rounded-full"
              style={{ color: "var(--kyb-green)", backgroundColor: "var(--kyb-green)" }}
            />
            Prêt
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <MockupTabs
            tab={tab}
            onTabChange={onTabChange}
            selected={selected}
            onSelect={onSelect}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[320px] overflow-y-auto">
      {section === "dashboard" && <DashboardPanel />}
      {section === "analyses" && <AnalysesPanel />}
      {section === "alertes" && <AlertsPanel />}
      {section === "sources" && <GlobalSourcesPanel />}
      {section === "parametres" && <SettingsPanel />}
    </div>
  );
}
