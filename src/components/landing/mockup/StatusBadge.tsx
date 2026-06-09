import type { CSSProperties } from "react";
import type { Tone } from "./mock-data";
import { TONE_COLOR } from "./mock-data";

/**
 * Pastille de statut harmonisée (preuve, source, gravité, priorité…).
 * Point coloré + libellé sur fond teinté. Présentational (rendu serveur OK).
 * Le pulse (`.kyb-pulse`) est neutralisé sous prefers-reduced-motion.
 */
export default function StatusBadge({
  label,
  tone = "neutral",
  pulse = false,
}: {
  label: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  const color = TONE_COLOR[tone];
  const wrap: CSSProperties = {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-medium"
      style={wrap}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${pulse ? "kyb-pulse" : ""}`}
        style={{ color, backgroundColor: color }}
      />
      {label}
    </span>
  );
}
