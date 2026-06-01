import { createHash } from "node:crypto";
import { getCasesRepository } from "@/lib/data/cases-repository";

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
  const payloadHash = createHash("sha256")
    .update(JSON.stringify({ bundle: detail.bundle, generatedAt }))
    .digest("hex");

  const manifest = {
    generator: "KYB Graph",
    generatedAt,
    payloadHash,
    bundle: detail.bundle,
    sources: detail.sources,
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
