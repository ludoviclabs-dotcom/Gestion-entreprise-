import type {
  CaseBundle,
  CaseEdge,
  CaseEntity,
  CaseEvent,
  CaseRiskSignal,
  CaseScores,
} from "@/lib/graph/graph-types";
import type { SourceKind } from "@/lib/graph/source";
import type {
  CaseOrigin,
  CaseStatus,
  EvidenceRow,
  ScoreStatus,
  SourceHealth,
  SourceRow,
} from "./types";

export function getSourceHealth(sources: SourceRow[]): SourceHealth {
  const total = sources.length;
  const fixture = sources.filter((s) => s.isFixture).length;
  const live = sources.filter((s) => !s.isFixture).length;
  const failed = sources.filter((s) => s.httpStatus >= 400).length;
  let origin: CaseOrigin = "unknown";
  if (total > 0 && fixture === total) origin = "fixture";
  else if (total > 0 && live === total) origin = "live";
  else if (total > 0) origin = "mixed";
  return { origin, total, live, fixture, failed };
}

export function getScoreStatus(
  scores: CaseScores,
  status?: CaseStatus,
): ScoreStatus {
  if (status === "error") return "error";
  const values = [
    scores.complexite,
    scores.vigilance,
    scores.qualitePreuve,
  ];
  const present = values.filter((v) => v !== undefined && v !== null).length;
  if (present === values.length) return "computed";
  if (present > 0) return "partial";
  return "missing";
}

function sourceFromText(text: string | undefined): SourceKind | null {
  const haystack = (text ?? "").toLowerCase();
  if (haystack.includes("sirene") || haystack.includes("insee")) return "sirene";
  if (haystack.includes("bodacc")) return "bodacc";
  if (haystack.includes("inpi") || haystack.includes("rne")) return "inpi";
  if (haystack.includes("trésor") || haystack.includes("tresor")) {
    return "tresor_gels";
  }
  if (haystack.includes("opensanctions")) return "opensanctions";
  if (haystack.includes("gleif")) return "gleif";
  if (haystack.includes("adresse nationale") || haystack.includes("(ban)")) {
    return "ban";
  }
  if (haystack.includes("vies") || haystack.includes("tva intracommunautaire")) {
    return "vies";
  }
  if (haystack.includes("gdelt") || haystack.includes("presse")) return "gdelt";
  return null;
}

export function inferEntitySource(entity: CaseEntity): SourceKind | null {
  return (
    sourceFromText(entity.source) ??
    sourceFromText(entity.excerpt) ??
    sourceFromText(Object.values(entity.attributes ?? {}).join(" "))
  );
}

export function inferEventSource(event: CaseEvent): SourceKind | null {
  return sourceFromText(event.source) ?? sourceFromText(event.title);
}

export function inferEdgeSource(
  edge: CaseEdge,
  bundle: CaseBundle,
): SourceKind | null {
  const target = bundle.entities.find((e) => e.id === edge.target);
  const source = bundle.entities.find((e) => e.id === edge.source);
  return (
    sourceFromText(edge.sourceLabel) ??
    sourceFromText(edge.excerpt) ??
    inferEntitySource(target ?? source ?? {
      id: "",
      type: "company",
      label: "",
      evidenceLevel: edge.evidenceLevel,
    }) ??
    (edge.type === "PARTAGE_ADRESSE" ? "sirene" : null) ??
    (edge.type === "DIRIGE" || edge.type === "DETIENT" ? "inpi" : null) ??
    (edge.type === "EST_VISE_PAR" ? "opensanctions" : null)
  );
}

export function inferSignalSource(
  signal: CaseRiskSignal,
  bundle: CaseBundle,
): SourceKind | null {
  if (signal.ruleId.includes("UBO")) return "inpi";
  if (signal.ruleId.includes("PROCEDURE") || signal.ruleId.includes("RADIATION")) {
    return "bodacc";
  }
  if (signal.ruleId.includes("SANCTION")) return "opensanctions";
  const subject = signal.subjectId
    ? bundle.entities.find((e) => e.id === signal.subjectId)
    : undefined;
  return subject ? inferEntitySource(subject) : null;
}

export function buildBundleEvidence(
  bundle: CaseBundle,
  sources: SourceRow[],
): EvidenceRow[] {
  const available = new Set(sources.map((s) => s.source));
  const cleanSource = (source: SourceKind | null) =>
    source && available.has(source) ? source : null;

  return [
    ...bundle.entities.map((entity) => ({
      subjectType: "entity" as const,
      subjectId: entity.id,
      source: cleanSource(inferEntitySource(entity)),
      level: entity.evidenceLevel,
      excerpt: entity.excerpt,
      pointer: { naturalKey: entity.id },
    })),
    ...bundle.edges.map((edge) => ({
      subjectType: "edge" as const,
      subjectId: edge.id,
      source: cleanSource(inferEdgeSource(edge, bundle)),
      level: edge.evidenceLevel,
      excerpt: edge.excerpt,
      pointer: { naturalKey: edge.id, edgeType: edge.type },
    })),
    ...bundle.events.map((event) => ({
      subjectType: "event" as const,
      subjectId: event.id,
      source: cleanSource(inferEventSource(event)),
      level: event.evidenceLevel,
      excerpt: event.title,
      pointer: { naturalKey: event.id, kind: event.kind },
    })),
    ...bundle.riskSignals.map((signal) => ({
      subjectType: "risk_signal" as const,
      subjectId: signal.id,
      source: cleanSource(inferSignalSource(signal, bundle)),
      level: "inferred" as const,
      excerpt: signal.explanation,
      pointer: { ruleId: signal.ruleId },
    })),
  ];
}
