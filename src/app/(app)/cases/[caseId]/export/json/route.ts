import { getCasesRepository } from "@/lib/data/cases-repository";
import {
  buildExportMeta,
  buildManifest,
  exportFilename,
  exportGate,
  resolveExportDetail,
} from "@/lib/export/case-export";

export const runtime = "nodejs";
// Co-localisation avec Neon (eu-central-1) : évite l'aller-retour US↔EU par requête.
export const preferredRegion = "fra1";

/**
 * Manifeste JSON d'audit : bundle complet + sources + métadonnées d'export
 * (date, hash). Destiné aux exports techniques et au rejeu d'une analyse.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const denied = exportGate(request);
  if (denied) return denied;

  const { caseId } = await params;
  const repository = getCasesRepository();
  const raw = await repository.getCase(caseId);
  if (!raw) {
    return new Response("Dossier introuvable", { status: 404 });
  }

  const { detail, redaction } = resolveExportDetail(raw, request);
  const meta = buildExportMeta(detail);
  const manifest = buildManifest(detail, meta, redaction);

  await repository.appendProofEvent(caseId, "export_genere", {
    format: "json",
    redaction,
    payloadHash: meta.payloadHash,
  });

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(detail, meta, "json")}"`,
      "Cache-Control": "no-store",
    },
  });
}
