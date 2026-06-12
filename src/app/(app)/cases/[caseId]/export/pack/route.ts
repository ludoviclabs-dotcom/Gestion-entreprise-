import { strToU8, zipSync } from "fflate";
import { getCasesRepository } from "@/lib/data/cases-repository";
import {
  buildExportMeta,
  exportFilename,
  exportGate,
  renderCasePdf,
  resolveExportDetail,
} from "@/lib/export/case-export";
import { VERIFY_SCRIPT, buildLisezmoi } from "@/lib/export/verify-script";
import { sha256Bytes } from "@/lib/audit/hash-chain";
import { SCORE_MODEL_VERSION } from "@/lib/risk/engine";

export const runtime = "nodejs";
// Co-localisation avec Neon (eu-central-1) : évite l'aller-retour US↔EU par requête.
export const preferredRegion = "fra1";

/**
 * Evidence Pack ZIP : rapport PDF + données de rejeu + journal de preuve +
 * script de vérification hors-ligne. Le manifest.json du pack référence
 * chaque fichier par son SHA-256 (les données vivent dans report-data.json,
 * pas dupliquées dans le manifeste) et la tête de chaîne du journal.
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
  const pdf = await renderCasePdf(detail, meta, redaction);
  // Journal AVANT l'événement d'export : un pack ne peut pas contenir le hash
  // de sa propre génération ; le prochain export l'inclura.
  const auditTrail = await repository.listProofEvents(caseId);

  const files: Record<string, Uint8Array> = {
    "report.pdf": new Uint8Array(pdf),
    "report-data.json": strToU8(
      JSON.stringify(
        {
          bundle: detail.bundle,
          sources: detail.sources,
          evidence: detail.evidence,
        },
        null,
        2,
      ),
    ),
    "audit-trail.json": strToU8(JSON.stringify(auditTrail, null, 2)),
    "LISEZMOI.txt": strToU8(
      buildLisezmoi({
        titre: detail.bundle.case.title,
        rootSiren: detail.bundle.case.rootSiren,
        generatedAt: meta.generatedAt,
      }),
    ),
    "verify.mjs": strToU8(VERIFY_SCRIPT),
  };

  const manifest = {
    schemaVersion: "kyb-pack/v1",
    generator: "KYB Graph",
    scoreModelVersion: SCORE_MODEL_VERSION,
    generatedAt: meta.generatedAt,
    payloadHash: meta.payloadHash,
    origin: meta.sourceHealth.origin,
    scoreStatus: meta.scoreStatus,
    sourceHealth: meta.sourceHealth,
    chainHead: auditTrail[auditTrail.length - 1]?.entryHash ?? null,
    redaction,
    // Réservé : signature Ed25519 du manifeste (gestion de clés à l'étape
    // souveraineté — cf. docs/sovereignty.md).
    signature: null,
    files: Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [name, sha256Bytes(bytes)]),
    ),
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

  const zip = zipSync(files, { level: 6 });

  await repository.appendProofEvent(caseId, "export_genere", {
    format: "pack",
    redaction,
    payloadHash: meta.payloadHash,
    fichiers: Object.keys(files).sort(),
  });

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFilename(detail, meta, "zip")}"`,
      "Cache-Control": "no-store",
    },
  });
}
