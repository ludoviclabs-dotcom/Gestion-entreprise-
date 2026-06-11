import { getCasesRepository } from "@/lib/data/cases-repository";
import {
  buildExportMeta,
  exportFilename,
  exportGate,
  renderCasePdf,
  resolveExportDetail,
} from "@/lib/export/case-export";

export const runtime = "nodejs";
// Co-localisation avec Neon (eu-central-1) : évite l'aller-retour US↔EU par requête.
export const preferredRegion = "fra1";

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
  const buffer = await renderCasePdf(detail, meta, redaction);

  await repository.appendProofEvent(caseId, "export_genere", {
    format: "pdf",
    redaction,
    payloadHash: meta.payloadHash,
  });

  // Node Buffer → Uint8Array : Response n'accepte pas Buffer directement
  // dans BodyInit (mismatch de typage côté TS), mais accepte Uint8Array.
  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${exportFilename(detail, meta, "pdf")}"`,
      "Cache-Control": "no-store",
    },
  });
}
