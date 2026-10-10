import type { ReactNode } from "react";
import Link from "next/link";
import { MetricChip } from "@/components/ui/metric-chip";
import { TONE_CSS_VAR } from "@/lib/design/tone";
import { toneForScore } from "@/lib/design/domain-tones";
import type { CaseScores } from "@/lib/graph/graph-types";

/** Sens d'un score : "risk" = plus haut est pire ; "good" = plus haut est mieux. */
export type ScorePolarity = "risk" | "good";
/** @deprecated alias historique de `ScorePolarity` (importé par la démo guidée). */
export type Tone = ScorePolarity;

/**
 * Couleur d'un score continu (seuils 34/67) — réutilisée par la démo guidée.
 * Source de vérité : les teintes sémantiques du design system (vert / vigilance /
 * critique), donc cohérentes avec les signaux et les statuts. Retourne la
 * référence CSS (`var(--tone-…)`), utilisable en `style` inline.
 * (La page /secteurs garde sa propre échelle 4 bandes, distincte par nature.)
 */
export function scoreColor(
  value: number | undefined,
  polarity: ScorePolarity,
): string {
  return TONE_CSS_VAR[toneForScore(value, polarity)];
}

function Pill({
  label,
  value,
  polarity,
  size = "md",
}: {
  label: string;
  value?: number;
  polarity: ScorePolarity;
  size?: "sm" | "md";
}) {
  return (
    <MetricChip
      label={label}
      value={value ?? "—"}
      tone={toneForScore(value, polarity)}
      size={size}
    />
  );
}

function linkable(node: ReactNode, href: string | undefined, title: string): ReactNode {
  if (!href) return node;
  return (
    <Link
      href={href}
      className="rounded-md transition-ui hover:opacity-80"
      title={title}
      aria-label={title}
    >
      {node}
    </Link>
  );
}

/** Trois scores labellisés : complexité / vigilance / qualité de preuve. Jamais « fraude ». */
export default function ScorePills({
  scores,
  size = "md",
  vigilanceHref,
  complexiteHref,
  qualiteHref,
}: {
  scores: CaseScores;
  size?: "sm" | "md";
  /** Si fournis, les scores deviennent cliquables vers leur décomposition (P3). */
  vigilanceHref?: string;
  complexiteHref?: string;
  qualiteHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {linkable(
        <Pill label="Complexité" value={scores.complexite} polarity="risk" size={size} />,
        complexiteHref,
        "Voir la composition du score de complexité",
      )}
      {linkable(
        <Pill label="Vigilance" value={scores.vigilance} polarity="risk" size={size} />,
        vigilanceHref,
        "Voir la composition du score de vigilance",
      )}
      {linkable(
        <Pill label="Qualité de preuve" value={scores.qualitePreuve} polarity="good" size={size} />,
        qualiteHref,
        "Voir la composition de la qualité de preuve",
      )}
    </div>
  );
}
