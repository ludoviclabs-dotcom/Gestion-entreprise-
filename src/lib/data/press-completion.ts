import { randomUUID } from "node:crypto";
import type {
  CaseBundle,
  CaseEvent,
  CaseRiskSignal,
  CaseScores,
} from "@/lib/graph/graph-types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import { normalizeGdelt } from "@/lib/ingestion/normalize-gdelt";
import { evaluateMediaCoverage } from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import { explainQualitePreuve, explainVigilance } from "@/lib/risk/engine";
import { payloadHash } from "@/lib/audit/hash-chain";
import { getSourceHealth } from "./case-quality";
import type { SourceHealth, SourceRow } from "./types";

/**
 * Complète un dossier dont la presse (GDELT) a été collectée APRÈS sa création.
 *
 * Aucun recalcul global : la presse n'alimente QU'UNE règle
 * (COUVERTURE_MEDIA_DEFAVORABLE) et les événements média entrent dans la qualité
 * de preuve. On calcule donc seulement :
 *  - les événements média et le signal éventuel, à partir des seuls articles ;
 *  - la vigilance = somme pondérée des signaux déjà persistés + les nouveaux ;
 *  - la qualité de preuve sur les éléments persistés + les événements média.
 * La complexité (graphe) n'est pas modifiée. Les autres règles — dont l'écart
 * UBO, qui dépend de données non persistées — ne sont jamais réévaluées.
 *
 * Pur : ne touche ni la base ni le réseau (testable seul).
 */
export type PressCompletionPlan = {
  sourceRecord: {
    id: string;
    caseId: string;
    source: "gdelt";
    endpoint: string;
    httpStatus: string;
    payload: unknown;
    payloadHash: string;
    isFixture: string;
  };
  events: CaseEvent[];
  signals: CaseRiskSignal[];
  eventRows: {
    id: string;
    caseId: string;
    entityId: string;
    kind: string;
    source: "gdelt";
    occurredOn: string | null;
    title: string;
    evidenceLevel: CaseEvent["evidenceLevel"];
    payload: { source: string | undefined };
  }[];
  signalRows: {
    id: string;
    caseId: string;
    ruleId: string;
    subjectType: "entity";
    subjectId: string | null;
    severity: CaseRiskSignal["severity"];
    category: CaseRiskSignal["category"];
    explanation: string;
  }[];
  evidenceRows: {
    caseId: string;
    subjectType: "event" | "risk_signal";
    subjectId: string;
    sourceRecordId: string;
    level: CaseEvent["evidenceLevel"];
    excerpt: string;
    pointer: Record<string, unknown>;
  }[];
  scores: CaseScores;
  sourceHealth: SourceHealth;
  /** La consultation a abouti (2xx, non dégradée) : seuls ses articles comptent. */
  usable: boolean;
};

export function planPressCompletion(args: {
  caseId: string;
  bundle: CaseBundle;
  sources: SourceRow[];
  gdelt: ConnectorResult<unknown>;
  subjectId: string;
}): PressCompletionPlan {
  const { caseId, bundle, gdelt, subjectId } = args;
  const usable =
    !gdelt.isFixture &&
    gdelt.httpStatus >= 200 &&
    gdelt.httpStatus < 300 &&
    !isDegradedEndpoint(gdelt.endpoint);

  const events = usable
    ? normalizeGdelt(gdelt.raw, { subjectId, entities: bundle.entities })
    : [];
  const signals = evaluateMediaCoverage(
    events,
    DEFAULT_THRESHOLDS.couvertureMedia.minAdverse,
  );

  const sourceRecordId = randomUUID();
  const sourceRecord = {
    id: sourceRecordId,
    caseId,
    source: "gdelt" as const,
    endpoint: gdelt.endpoint,
    httpStatus: String(gdelt.httpStatus),
    payload: gdelt.raw,
    payloadHash: payloadHash(gdelt.raw),
    isFixture: gdelt.isFixture ? "true" : "false",
  };

  const evidenceRows: PressCompletionPlan["evidenceRows"] = [];
  const eventRows = events.map((ev) => {
    const id = randomUUID();
    evidenceRows.push({
      caseId,
      subjectType: "event",
      subjectId: id,
      sourceRecordId,
      level: ev.evidenceLevel,
      excerpt: ev.title,
      pointer: { naturalKey: ev.id, kind: ev.kind },
    });
    return {
      id,
      caseId,
      entityId: ev.entityId,
      kind: ev.kind,
      source: "gdelt" as const,
      occurredOn: ev.occurredOn ?? null,
      title: ev.title,
      evidenceLevel: ev.evidenceLevel,
      payload: { source: ev.source },
    };
  });
  const signalRows = signals.map((sig) => {
    const id = randomUUID();
    evidenceRows.push({
      caseId,
      subjectType: "risk_signal",
      subjectId: id,
      sourceRecordId,
      level: "inferred",
      excerpt: sig.explanation,
      pointer: { naturalKey: sig.id, ruleId: sig.ruleId },
    });
    return {
      id,
      caseId,
      ruleId: sig.ruleId,
      subjectType: "entity" as const,
      subjectId: sig.subjectId ?? null,
      severity: sig.severity,
      category: sig.category,
      explanation: sig.explanation,
    };
  });

  const scores: CaseScores = {
    complexite: bundle.case.scores?.complexite,
    vigilance: explainVigilance([...bundle.riskSignals, ...signals]).score,
    qualitePreuve: explainQualitePreuve({
      ...bundle,
      events: [...bundle.events, ...events],
    }).score,
  };

  const sourceHealth = getSourceHealth([
    ...args.sources,
    {
      source: "gdelt",
      endpoint: gdelt.endpoint,
      httpStatus: gdelt.httpStatus,
      isFixture: gdelt.isFixture,
    },
  ]);

  return {
    sourceRecord,
    events,
    signals,
    eventRows,
    signalRows,
    evidenceRows,
    scores,
    sourceHealth,
    usable,
  };
}
