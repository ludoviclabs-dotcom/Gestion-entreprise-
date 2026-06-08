import type { CaseStatus, CaseSummary, ScoreStatus } from "./types";

const STATUS_WEIGHT: Record<CaseStatus, number> = {
  ready: 4,
  enriching: 3,
  draft: 2,
  error: 0,
};

const SCORE_WEIGHT: Record<ScoreStatus, number> = {
  computed: 4,
  partial: 2,
  missing: 1,
  error: 0,
};

const ORIGIN_WEIGHT: Record<CaseSummary["origin"], number> = {
  live: 4,
  mixed: 3,
  fixture: 2,
  unknown: 1,
};

function rankCase(item: CaseSummary): number {
  const featuredDemo = item.id === "demo-holding" ? 100 : 0;
  return (
    featuredDemo +
    STATUS_WEIGHT[item.status] * 10 +
    SCORE_WEIGHT[item.scoreStatus] * 4 +
    ORIGIN_WEIGHT[item.origin]
  );
}

function isBetterCase(candidate: CaseSummary, current: CaseSummary): boolean {
  const rankDelta = rankCase(candidate) - rankCase(current);
  if (rankDelta !== 0) return rankDelta > 0;
  return candidate.updatedAt.localeCompare(current.updatedAt) > 0;
}

export type CuratedCases = {
  visible: CaseSummary[];
  hidden: CaseSummary[];
  hiddenErrors: number;
  hiddenDuplicates: number;
};

export function curateCaseSummaries(cases: CaseSummary[]): CuratedCases {
  const hidden = new Set<string>();
  const bestBySiren = new Map<string, CaseSummary>();

  for (const item of cases) {
    if (item.status === "error") {
      hidden.add(item.id);
      continue;
    }

    const existing = bestBySiren.get(item.rootSiren);
    if (!existing) {
      bestBySiren.set(item.rootSiren, item);
      continue;
    }

    if (isBetterCase(item, existing)) {
      hidden.add(existing.id);
      bestBySiren.set(item.rootSiren, item);
    } else {
      hidden.add(item.id);
    }
  }

  const visible = cases
    .filter((item) => !hidden.has(item.id))
    .sort((a, b) => {
      if (a.id === "demo-holding") return -1;
      if (b.id === "demo-holding") return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const hiddenCases = cases.filter((item) => hidden.has(item.id));
  return {
    visible,
    hidden: hiddenCases,
    hiddenErrors: hiddenCases.filter((item) => item.status === "error").length,
    hiddenDuplicates: hiddenCases.filter((item) => item.status !== "error")
      .length,
  };
}
