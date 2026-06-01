import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { CaseReport } from "@/components/reports/CaseReport";

export const runtime = "nodejs";

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

  const buffer = await renderToBuffer(
    CaseReport({
      bundle: detail.bundle,
      sources: detail.sources,
      generatedAt,
      payloadHash,
    }),
  );

  const isoDate = generatedAt.slice(0, 10);
  const filename = `dossier-${detail.bundle.case.rootSiren}-${isoDate}.pdf`;

  // Node Buffer → Uint8Array : Response n'accepte pas Buffer directement
  // dans BodyInit (mismatch de typage côté TS), mais accepte Uint8Array.
  const body = new Uint8Array(buffer);

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
