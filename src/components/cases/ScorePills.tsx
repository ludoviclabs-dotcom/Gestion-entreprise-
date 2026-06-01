import type { CaseScores } from "@/lib/graph/graph-types";

type Tone = "risk" | "good";

function scoreColor(value: number | undefined, tone: Tone): string {
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
}: {
  scores: CaseScores;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill label="Complexité" value={scores.complexite} tone="risk" size={size} />
      <Pill label="Vigilance" value={scores.vigilance} tone="risk" size={size} />
      <Pill
        label="Qualité de preuve"
        value={scores.qualitePreuve}
        tone="good"
        size={size}
      />
    </div>
  );
}
