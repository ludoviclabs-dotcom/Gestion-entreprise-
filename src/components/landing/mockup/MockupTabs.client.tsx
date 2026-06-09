"use client";

import { Tabs } from "radix-ui";
import { DOSSIER_TABS, type Tab } from "./mock-data";
import GraphTab from "./GraphTab.client";
import EvidenceTimeline from "./EvidenceTimeline";
import SourcesPanel from "./SourcesPanel";
import ScoreBreakdown from "./ScoreBreakdown.client";
import AnalysisPanel from "./AnalysisPanel";

/**
 * Onglets internes du dossier. Radix Tabs (contrôlé) → rôles tablist/tab/
 * tabpanel, aria-selected/controls, ids et navigation clavier (flèches /
 * Home / End) gratuits. Skin custom aux tokens --kyb-*.
 */
export default function MockupTabs({
  tab,
  onTabChange,
  selected,
  onSelect,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Tabs.Root
      value={tab}
      onValueChange={(v) => onTabChange(v as Tab)}
      className="flex h-full min-h-0 flex-col"
    >
      <Tabs.List
        aria-label="Onglets du dossier"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--kyb-line)] px-2.5 pt-1"
      >
        {DOSSIER_TABS.map((t) => (
          <Tabs.Trigger
            key={t}
            value={t}
            className="relative whitespace-nowrap rounded-md px-3 py-2 text-[12px] text-[var(--kyb-text-mid)] outline-none transition-colors hover:text-[var(--kyb-text-hi)] focus-visible:ring-2 focus-visible:ring-[var(--kyb-violet)]/60 data-[state=active]:font-semibold data-[state=active]:text-[var(--kyb-text-hi)] [&[data-state=active]>span]:opacity-100"
          >
            {t}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2 bottom-[-1px] h-0.5 rounded-sm opacity-0 transition-opacity"
              style={{
                background:
                  "linear-gradient(90deg, var(--kyb-violet), var(--kyb-violet-soft))",
              }}
            />
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <div className="relative min-h-[252px] flex-1 overflow-y-auto">
        <Tabs.Content value="Graphe" className="h-full outline-none">
          <GraphTab selected={selected} onSelect={onSelect} />
        </Tabs.Content>
        <Tabs.Content
          value="Preuve"
          className="outline-none animate-in fade-in duration-150"
        >
          <EvidenceTimeline />
        </Tabs.Content>
        <Tabs.Content
          value="Sources"
          className="outline-none animate-in fade-in duration-150"
        >
          <SourcesPanel />
        </Tabs.Content>
        <Tabs.Content
          value="Scores"
          className="outline-none animate-in fade-in duration-150"
        >
          <ScoreBreakdown />
        </Tabs.Content>
        <Tabs.Content
          value="Analyse"
          className="outline-none animate-in fade-in duration-150"
        >
          <AnalysisPanel />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
