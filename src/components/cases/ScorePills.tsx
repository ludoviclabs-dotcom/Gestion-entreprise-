import Link from "next/link";
import { SEVERITY_COLORS } from "@/lib/graph/graph-types";
import type { CaseScores } from "@/lib/graph/graph-types";

export type Tone = "risk" | "good";

/**
 * Couleur produit d'un score continu (seuils 34/67) — réutilisée par la démo
 * guidée. Source de vérité unique : la palette de sévérité `SEVERITY_COLORS`
 * (les bandes vert/ambre/rouge), pour cohérence avec les signaux (pattern P2).
 * (La page /secteurs garde sa propre échelle 4 bandes, distincte par nature.)
 */
export function scoreColor(value: number | undefined, tone: Tone): string {
  if (value === undefined) return SEVERITY_COLORS.info;
  const high = SEVERITY_COLORS.high;
  const mid = SEVERITY_COLORS.medium;
  const low = SEVERITY_COLORS.low;
  if (tone === "good") return value >= 67 ? low : value >= 34 ? mid : high;
  return value >= 67 ? high : value >= 34 ? mid : low;
}

function Pill({
  label,
  value,
  tone,
  size = "md",
}: {
  label: string;
  value?: number;
  tone: Tone;
  size?: "sm" | "md";
}) {
  const color = scoreColor(value, tone);
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-border bg-surface/90 ${
        size === "sm" ? "px-2 py-1" : "px-3 py-1.5"
      }`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={size === "sm" ? "text-xs font-semibold" : "text-sm font-semibold"}
        style={{ color }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Trois scores labellisés : complexité / vigilance / qualité de preuve. Jamais « fraude ». */
export default function ScorePills({
  scores,
  size = "md",
  vigilanceHref,
}: {
  scores: CaseScores;
  size?: "sm" | "md";
  /** Si fourni, le score de vigilance devient cliquable vers sa décomposition (P3). */
  vigilanceHref?: string;
}) {
  const vigilance = (
    <Pill label="Vigilance" value={scores.vigilance} tone="risk" size={size} />
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill label="Complexité" value={scores.complexite} tone="risk" size={size} />
      {vigilanceHref ? (
        <Link
          href={vigilanceHref}
          className="rounded-lg transition hover:opacity-80"
          title="Voir la composition du score de vigilance"
          aria-label="Voir la composition du score de vigilance"
        >
          {vigilance}
        </Link>
      ) : (
        vigilance
      )}
      <Pill
        label="Qualité de preuve"
        value={scores.qualitePreuve}
        tone="good"
        size={size}
      />
    </div>
  );
}
