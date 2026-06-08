import { Activity, DatabaseZap, FlaskConical, Gauge, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CaseOrigin, ScoreStatus, SourceHealth } from "@/lib/data/types";

const ORIGIN_META: Record<
  CaseOrigin,
  { label: string; tone: string; icon: typeof DatabaseZap }
> = {
  live: {
    label: "Live",
    tone: "border-emerald/40 bg-emerald/10 text-emerald",
    icon: DatabaseZap,
  },
  mixed: {
    label: "Mixte",
    tone: "border-amber/40 bg-amber/10 text-amber",
    icon: Activity,
  },
  fixture: {
    label: "Demo",
    tone: "border-violet/40 bg-violet/10 text-violet",
    icon: FlaskConical,
  },
  unknown: {
    label: "Origine inconnue",
    tone: "border-border bg-surface text-muted-foreground",
    icon: DatabaseZap,
  },
};

const SCORE_META: Record<ScoreStatus, { label: string; tone: string }> = {
  computed: {
    label: "Score calcule",
    tone: "border-emerald/40 bg-emerald/10 text-emerald",
  },
  partial: {
    label: "Score partiel",
    tone: "border-amber/40 bg-amber/10 text-amber",
  },
  missing: {
    label: "Score manquant",
    tone: "border-border bg-surface text-muted-foreground",
  },
  error: {
    label: "Score erreur",
    tone: "border-red/40 bg-red/10 text-red",
  },
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
  const Icon = meta.icon;
  const title = sourceHealth
    ? `${sourceHealth.live} live, ${sourceHealth.fixture} demo, ${sourceHealth.failed} echec(s)`
    : meta.label;
  return (
    <Badge variant="outline" className={meta.tone} title={title}>
      <Icon size={12} />
      {compact ? meta.label : `${meta.label}${sourceHealth ? ` ${sourceHealth.live}/${sourceHealth.total}` : ""}`}
    </Badge>
  );
}

export function ScoreStatusBadge({
  scoreStatus,
  compact = false,
}: {
  scoreStatus: ScoreStatus;
  compact?: boolean;
}) {
  const meta = SCORE_META[scoreStatus];
  return (
    <Badge variant="outline" className={meta.tone}>
      <Gauge size={12} />
      {compact ? meta.label.replace("Score ", "") : meta.label}
    </Badge>
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
    <Badge
      variant="outline"
      className={
        hasFailure
          ? "border-red/40 bg-red/10 text-red"
          : "border-border bg-surface text-muted-foreground"
      }
      title={`${sourceHealth.total} source(s), ${sourceHealth.failed} echec(s)`}
    >
      <ShieldCheck size={12} />
      {compact
        ? `${sourceHealth.failed}/${sourceHealth.total}`
        : `${sourceHealth.failed} echec source`}
    </Badge>
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
