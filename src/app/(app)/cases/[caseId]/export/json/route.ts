import { createHash } from "node:crypto";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { getScoreStatus, getSourceHealth } from "@/lib/data/case-quality";
import { SCORE_MODEL_VERSION } from "@/lib/risk/engine";

export const runtime = "nodejs";

/**
 * Manifeste JSON d'audit : bundle complet + sources + métadonnées d'export
 * (date, hash). Destiné aux exports techniques et au rejeu d'une analyse.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) {
    return new Response("Dossier introuvable", { status: 404 });
  }

  const generatedAt = new Date().toISOString();
  const sourceHealth = getSourceHealth(detail.sources);
  const scoreStatus = getScoreStatus(detail.bundle.case.scores ?? {});
  const payloadHash = createHash("sha256")
    .update(
      JSON.stringify({
        bundle: detail.bundle,
        evidence: detail.evidence,
        generatedAt,
      }),
    )
    .digest("hex");

  const manifest = {
    generator: "KYB Graph",
    scoreModelVersion: SCORE_MODEL_VERSION,
    generatedAt,
    payloadHash,
    origin: sourceHealth.origin,
    scoreStatus,
    sourceHealth,
    bundle: detail.bundle,
    sources: detail.sources,
    evidence: detail.evidence,
  };

  const filename = `dossier-${detail.bundle.case.rootSiren}-${generatedAt.slice(0, 10)}.json`;
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
