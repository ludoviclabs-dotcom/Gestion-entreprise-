import type { CSSProperties } from "react";

/**
 * Pastille de preuve : point coloré (optionnellement pulsant) + libellé.
 * Aucun hook → rendu côté serveur possible. Le pulse utilise la classe
 * `.kyb-pulse`, automatiquement neutralisée sous `prefers-reduced-motion`
 * (cf. globals.css). `color` est attendu sous forme de token, ex.
 * `var(--kyb-green)`.
 */
export default function ProofBadge({
  label,
  color,
  pulse = false,
}: {
  label: string;
  color: string;
  pulse?: boolean;
}) {
  const dotStyle: CSSProperties = { color, backgroundColor: color };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--kyb-line)] bg-white/[0.03] px-2.5 py-[3px] text-[11px] text-[var(--kyb-text-mid)]">
      <span
        className={`h-[7px] w-[7px] rounded-full ${pulse ? "kyb-pulse" : ""}`}
        style={dotStyle}
      />
      {label}
    </span>
  );
}
