import { Activity, DatabaseZap, FlaskConical, Gauge, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CASE_ORIGIN_TONE, SCORE_STATUS_TONE } from "@/lib/design/domain-tones";
import type { CaseOrigin, ScoreStatus, SourceHealth } from "@/lib/data/types";

const ORIGIN_META: Record<
  CaseOrigin,
  { label: string; icon: typeof DatabaseZap }
> = {
  live: { label: "Live", icon: DatabaseZap },
  mixed: { label: "Mixte", icon: Activity },
  fixture: { label: "Démo", icon: FlaskConical },
  unknown: { label: "Origine inconnue", icon: DatabaseZap },
};

const SCORE_LABELS: Record<ScoreStatus, string> = {
  computed: "Score calculé",
  partial: "Score partiel",
  missing: "Score manquant",
  error: "Score erreur",
};

export function OriginBadge({
  origin,
  sourceHealth,
  compact = false,
}: {
  origin: CaseOrigin;
  sourceHealth?: SourceHealth;
  compact?: boolean;
}) {
  const meta = ORIGIN_META[origin];
  const title = sourceHealth
    ? `${sourceHealth.live} live, ${sourceHealth.fixture} démo, ${sourceHealth.failed} échec(s)`
    : meta.label;
  return (
    <StatusBadge tone={CASE_ORIGIN_TONE[origin]} icon={meta.icon} title={title}>
      {compact ? meta.label : `${meta.label}${sourceHealth ? ` ${sourceHealth.live}/${sourceHealth.total}` : ""}`}
    </StatusBadge>
  );
}

export function ScoreStatusBadge({
  scoreStatus,
  compact = false,
}: {
  scoreStatus: ScoreStatus;
  compact?: boolean;
}) {
  const label = SCORE_LABELS[scoreStatus];
  return (
    <StatusBadge tone={SCORE_STATUS_TONE[scoreStatus]} icon={Gauge}>
      {compact ? label.replace("Score ", "") : label}
    </StatusBadge>
  );
}

export function SourceHealthBadge({
  sourceHealth,
  compact = false,
}: {
  sourceHealth: SourceHealth;
  compact?: boolean;
}) {
  const hasFailure = sourceHealth.failed > 0;
  return (
    <StatusBadge
      tone={hasFailure ? "critical" : "neutral"}
      icon={ShieldCheck}
      title={`${sourceHealth.total} source(s), ${sourceHealth.failed} échec(s)`}
    >
      {compact
        ? `${sourceHealth.failed}/${sourceHealth.total}`
        : `${sourceHealth.failed} échec source`}
    </StatusBadge>
  );
}

export default function CaseQualityBadges({
  origin,
  scoreStatus,
  sourceHealth,
  compact = false,
}: {
  origin: CaseOrigin;
  scoreStatus: ScoreStatus;
  sourceHealth: SourceHealth;
  compact?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <OriginBadge
        origin={origin}
        sourceHealth={sourceHealth}
        compact={compact}
      />
      <ScoreStatusBadge scoreStatus={scoreStatus} compact={compact} />
      {sourceHealth.failed > 0 ? (
        <SourceHealthBadge sourceHealth={sourceHealth} compact={compact} />
      ) : null}
    </span>
  );
}
