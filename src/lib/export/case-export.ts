import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { getScoreStatus, getSourceHealth } from "@/lib/data/case-quality";
import { CaseReport } from "@/components/reports/CaseReport";
import {
  SCORE_MODEL_VERSION,
  computeConvergence,
  explainVigilance,
} from "@/lib/risk/engine";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import { env } from "@/lib/env";
import { redactCaseDetail, type RedactionMode } from "./redaction";
import type {
  CaseDetail,
  ScoreStatus,
  SourceHealth,
} from "@/lib/data/types";

/**
 * Logique partagée des routes d'export (json / pdf / pack) — extraite pour
 * éviter la duplication et appliquer la même redaction/méta partout.
 */

export type ExportMeta = {
  generatedAt: string;
  sourceHealth: SourceHealth;
  scoreStatus: ScoreStatus;
  payloadHash: string;
};

/**
 * Gate optionnelle par jeton partagé (`EXPORT_TOKEN`, même esprit que
 * CRON_SECRET). Renvoie la réponse 401 à retourner, ou null si l'accès est
 * autorisé (jeton valide, ou aucune gate configurée — défaut zéro-clé).
 */
export function exportGate(request: Request): Response | null {
  if (!env.EXPORT_TOKEN) return null;
  const token = new URL(request.url).searchParams.get("token");
  if (token === env.EXPORT_TOKEN) return null;
  return new Response("Export protégé : jeton requis (?token=).", {
    status: 401,
  });
}

/**
 * Applique l'option `?redact=persons` de la requête au détail du dossier.
 * Renvoie le détail (éventuellement masqué) + le mode retenu, pour que le
 * manifeste et le PDF l'affichent.
 */
export function resolveExportDetail(
  detail: CaseDetail,
  request: Request,
): { detail: CaseDetail; redaction: RedactionMode } {
  const redact =
    new URL(request.url).searchParams.get("redact") === "persons";
  if (!redact) return { detail, redaction: "none" };
  return { detail: redactCaseDetail(detail), redaction: "persons" };
}

/**
 * Métadonnées d'export. Le `payloadHash` conserve la convention HISTORIQUE
 * (sha256 de JSON.stringify, ordre d'insertion) pour ne pas invalider les
 * hashes des exports déjà émis — distincte de la sérialisation canonique du
 * journal (cf. docs/data-model.md).
 */
export function buildExportMeta(
  detail: CaseDetail,
  generatedAt: string = new Date().toISOString(),
): ExportMeta {
  const payloadHash = createHash("sha256")
    .update(
      JSON.stringify({
        bundle: detail.bundle,
        evidence: detail.evidence,
        generatedAt,
      }),
    )
    .digest("hex");
  return {
    generatedAt,
    sourceHealth: getSourceHealth(detail.sources),
    scoreStatus: getScoreStatus(detail.bundle.case.scores ?? {}),
    payloadHash,
  };
}

/**
 * Analytique dérivée d'un dossier pour les exports (facteurs atténuants,
 * faisceau, décomposition vigilance). `now` dérivé de la date d'export →
 * déterministe pour un export donné. N'altère pas le payloadHash (calculé sur
 * bundle + evidence + generatedAt uniquement).
 */
export function buildCaseAnalytics(detail: CaseDetail, now: Date) {
  const signals = detail.bundle.riskSignals;
  return {
    mitigatingFactors: computeMitigatingFactors(detail.bundle, now),
    faisceau: computeConvergence(signals, DEFAULT_THRESHOLDS.convergence.k),
    vigilance: explainVigilance(signals),
  };
}

/** Manifeste JSON d'audit (forme de la route export/json + mode de redaction). */
export function buildManifest(
  detail: CaseDetail,
  meta: ExportMeta,
  redaction: RedactionMode = "none",
) {
  const analytics = buildCaseAnalytics(detail, new Date(meta.generatedAt));
  return {
    generator: "KYB Graph",
    scoreModelVersion: SCORE_MODEL_VERSION,
    generatedAt: meta.generatedAt,
    payloadHash: meta.payloadHash,
    origin: meta.sourceHealth.origin,
    scoreStatus: meta.scoreStatus,
    sourceHealth: meta.sourceHealth,
    redaction,
    bundle: detail.bundle,
    sources: detail.sources,
    evidence: detail.evidence,
    mitigatingFactors: analytics.mitigatingFactors,
    faisceau: analytics.faisceau,
    vigilanceBreakdown: analytics.vigilance,
  };
}

/** Rapport PDF (React-PDF) du dossier. */
export async function renderCasePdf(
  detail: CaseDetail,
  meta: ExportMeta,
  redaction: RedactionMode = "none",
): Promise<Buffer> {
  const analytics = buildCaseAnalytics(detail, new Date(meta.generatedAt));
  return renderToBuffer(
    CaseReport({
      bundle: detail.bundle,
      sources: detail.sources,
      evidence: detail.evidence,
      sourceHealth: meta.sourceHealth,
      scoreStatus: meta.scoreStatus,
      scoreModelVersion: SCORE_MODEL_VERSION,
      generatedAt: meta.generatedAt,
      payloadHash: meta.payloadHash,
      redaction,
      mitigatingFactors: analytics.mitigatingFactors,
      faisceau: analytics.faisceau,
      vigilanceContributions: analytics.vigilance.contributions,
    }),
  );
}

/** Nom de fichier d'export : dossier-<siren>-<date>.<ext>. */
export function exportFilename(
  detail: CaseDetail,
  meta: ExportMeta,
  extension: string,
): string {
  const isoDate = meta.generatedAt.slice(0, 10);
  return `dossier-${detail.bundle.case.rootSiren}-${isoDate}.${extension}`;
}
