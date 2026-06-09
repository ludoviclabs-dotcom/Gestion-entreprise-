import type { LucideIcon } from "lucide-react";

/**
 * Item de navigation latérale. `aria-label` porte toujours le libellé (le texte
 * visible est masqué < lg), `aria-current` signale la section active. Le bouton
 * s'étire en pleine largeur dans le rail vertical (align-items: stretch) et
 * reste compact dans la bande horizontale mobile.
 */
export default function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--kyb-violet)]/60 ${
        active
          ? "bg-white/[0.07] text-[var(--kyb-text-hi)]"
          : "text-[var(--kyb-text-mid)] hover:bg-white/[0.04] hover:text-[var(--kyb-text-hi)]"
      }`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="hidden truncate lg:inline">{label}</span>
    </button>
  );
}
