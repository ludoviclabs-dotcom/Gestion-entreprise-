"use client";

import SidebarItem from "./SidebarItem";
import { NAV_SECTIONS, type Section } from "./mock-data";

/**
 * Navigation latérale du mockup. Responsive :
 *  - < sm  : bande horizontale scrollable d'icônes (au-dessus du panneau)
 *  - sm–lg : rail vertical d'icônes seules
 *  - ≥ lg  : rail vertical icône + libellé
 */
export default function Sidebar({
  active,
  onSelect,
}: {
  active: Section;
  onSelect: (s: Section) => void;
}) {
  return (
    <nav
      aria-label="Navigation du mockup"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--kyb-line)] bg-white/[0.015] p-2 sm:w-[52px] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r lg:w-[164px]"
    >
      {NAV_SECTIONS.map((s) => (
        <SidebarItem
          key={s.id}
          icon={s.icon}
          label={s.label}
          active={active === s.id}
          onClick={() => onSelect(s.id)}
        />
      ))}
    </nav>
  );
}
