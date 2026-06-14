import { NextResponse } from "next/server";
import { rateLimit, ipKey } from "@/lib/server/rate-limit";
import { docling } from "@/lib/connectors/docling";
import { normalizeDocling } from "@/lib/ingestion/normalize-docling";
import { getCasesRepository } from "@/lib/data/cases-repository";

export const runtime = "nodejs";
// Co-localisation avec Neon (eu-central-1) + sidecar Docling souverain.
export const preferredRegion = "fra1";

const MAX_BYTES = 15 * 1024 * 1024; // 15 Mo
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

/**
 * Ajout d'un document (Kbis/statuts) à un dossier : extraction Docling →
 * normalisation → fusion (résolution d'entités) → recalcul du risque. En mode
 * démo / sans DOCLING_BASE_URL, l'extraction provient d'une fixture (testable
 * sans service Python). Fonctionne sur les dossiers créés en session.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await ctx.params;

  const rl = rateLimit(ipKey(request), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans un instant." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  // Garde-fou DoS : rejeter tôt sur Content-Length avant de bufferiser le corps.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 15 Mo)." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corps multipart invalide." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Champ « file » manquant." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Fichier vide ou trop volumineux (max 15 Mo)." },
      { status: 413 },
    );
  }
  // Type vide/inconnu rejeté aussi (un client peut omettre le Content-Type).
  if (!file.type || !ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Type non supporté (PDF, PNG, JPEG)." },
      { status: 415 },
    );
  }

  let extraction: Awaited<ReturnType<typeof docling.extract>>;
  let normalized: ReturnType<typeof normalizeDocling>;
  try {
    extraction = await docling.extract(file);
    normalized = normalizeDocling(extraction.raw);
  } catch {
    return NextResponse.json(
      { error: "Service d'extraction Docling indisponible." },
      { status: 502 },
    );
  }
  if (normalized.entities.length === 0) {
    return NextResponse.json(
      { error: "Aucune entité exploitable extraite du document." },
      { status: 422 },
    );
  }

  try {
    const result = await getCasesRepository().addSourceDocument(
      caseId,
      {
        source: "docling",
        endpoint: extraction.endpoint,
        httpStatus: extraction.httpStatus,
        raw: extraction.raw,
        isFixture: extraction.isFixture,
      },
      normalized,
    );
    return NextResponse.json({
      ok: true,
      mode: extraction.isFixture ? "demo" : "docling",
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Échec de l'ajout du document.",
      },
      { status: 409 },
    );
  }
}
