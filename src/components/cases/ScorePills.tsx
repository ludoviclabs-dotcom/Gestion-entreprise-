import Link from "next/link";
import type { CaseScores } from "@/lib/graph/graph-types";

export type Tone = "risk" | "good";

/** Couleur produit d'un score (seuils 34/67) — réutilisée par la démo guidée. */
export function scoreColor(value: number | undefined, tone: Tone): string {
  if (value === undefined) return "#64748b";
  const high = "#ef4444";
  const mid = "#f59e0b";
  const low = "#10b981";
  if (tone === "good") return value >= 67 ? low : value >= 34 ? mid : high;
  return value >= 67 ? high : value >= 34 ? mid : low;
}

function Pill({
  label,
  value,
  tone,
  size = "md",
  href,
}: {
  label: string;
  value?: number;
  tone: Tone;
  size?: "sm" | "md";
  href?: string;
}) {
  const color = scoreColor(value, tone);
  const inner = (
    <div
      className={`flex items-center gap-2 rounded-lg border border-border bg-surface/90 ${
        size === "sm" ? "px-2 py-1" : "px-3 py-1.5"
      } ${href ? "transition hover:border-violet/40" : ""}`}
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
  // Score décomposable → lien vers sa décomposition (critère : un score affiché
  // est cliquable vers son « pourquoi »).
  return href ? (
    <Link href={href} title={`${label} — voir la décomposition`}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Trois scores labellisés : complexité / vigilance / qualité de preuve. Jamais « fraude ». */
export default function ScorePills({
  scores,
  size = "md",
  caseId,
}: {
  scores: CaseScores;
  size?: "sm" | "md";
  /** Si fourni, chaque score devient cliquable vers sa décomposition. */
  caseId?: string;
}) {
  const link = (tab: string, anchor: string, value?: number): string | undefined =>
    caseId && value !== undefined ? `/cases/${caseId}/${tab}#${anchor}` : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        label="Complexité"
        value={scores.complexite}
        tone="risk"
        size={size}
        href={link("analyse", "complexite", scores.complexite)}
      />
      <Pill
        label="Vigilance"
        value={scores.vigilance}
        tone="risk"
        size={size}
        href={link("risques", "vigilance", scores.vigilance)}
      />
      <Pill
        label="Qualité de preuve"
        value={scores.qualitePreuve}
        tone="good"
        size={size}
        href={link("risques", "qualite-preuve", scores.qualitePreuve)}
      />
    </div>
  );
}
