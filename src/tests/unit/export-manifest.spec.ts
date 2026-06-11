import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExportMeta, buildManifest } from "@/lib/export/case-export";
import { VERIFY_SCRIPT } from "@/lib/export/verify-script";
import { chainNext } from "@/lib/audit/journal";
import { sha256Bytes } from "@/lib/audit/hash-chain";
import { fixtureCasesById } from "@/lib/fixtures/cases";
import { buildBundleEvidence } from "@/lib/data/case-quality";
import type { CaseDetail } from "@/lib/data/types";

const HEX64 = /^[a-f0-9]{64}$/;

function demoDetail(): CaseDetail {
  const fx = fixtureCasesById.get("demo-holding")!;
  return {
    bundle: fx.bundle,
    sources: fx.sources,
    evidence: buildBundleEvidence(fx.bundle, fx.sources),
  };
}

describe("export partagé (case-export)", () => {
  it("buildExportMeta : déterministe à generatedAt fixé, hash historique", () => {
    const detail = demoDetail();
    const at = "2026-06-01T00:00:00.000Z";
    const a = buildExportMeta(detail, at);
    const b = buildExportMeta(detail, at);
    expect(a).toEqual(b);
    expect(a.payloadHash).toMatch(HEX64);
    expect(a.sourceHealth.origin).toBe("fixture");
  });

  it("buildManifest : forme inchangée de la route export/json", () => {
    const detail = demoDetail();
    const manifest = buildManifest(
      detail,
      buildExportMeta(detail, "2026-06-01T00:00:00.000Z"),
    );
    expect(manifest.generator).toBe("KYB Graph");
    expect(manifest.payloadHash).toMatch(HEX64);
    expect(manifest.bundle.case.id).toBe("demo-holding");
    expect(Array.isArray(manifest.sources)).toBe(true);
    expect(Array.isArray(manifest.evidence)).toBe(true);
  });
});

describe("verify.mjs embarqué dans l'Evidence Pack", () => {
  it("valide un mini-pack intègre puis détecte l'altération (hors-ligne)", () => {
    const dir = mkdtempSync(join(tmpdir(), "kyb-verify-"));

    // Mini journal chaîné (2 entrées).
    const at = "2026-01-01T00:00:00.000Z";
    const e1 = chainNext(null, {
      caseId: "c1",
      kind: "dossier_cree",
      occurredAt: at,
      payload: { titre: "T" },
    });
    const e2 = chainNext(e1, {
      caseId: "c1",
      kind: "export_genere",
      occurredAt: at,
      payload: { format: "pack" },
    });

    const reportData = Buffer.from('{"ok":true}', "utf8");
    const trailBytes = Buffer.from(JSON.stringify([e1, e2], null, 2), "utf8");
    const manifest = {
      schemaVersion: "kyb-pack/v1",
      chainHead: e2.entryHash,
      files: {
        "report-data.json": sha256Bytes(reportData),
        "audit-trail.json": sha256Bytes(trailBytes),
      },
    };

    writeFileSync(join(dir, "report-data.json"), reportData);
    writeFileSync(join(dir, "audit-trail.json"), trailBytes);
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    writeFileSync(join(dir, "verify.mjs"), VERIFY_SCRIPT, "utf8");

    // Pack intègre → exit 0.
    expect(() =>
      execFileSync(process.execPath, [join(dir, "verify.mjs")]),
    ).not.toThrow();

    // Altération d'un fichier référencé → exit 1.
    writeFileSync(join(dir, "report-data.json"), '{"ok":false}', "utf8");
    expect(() =>
      execFileSync(process.execPath, [join(dir, "verify.mjs")]),
    ).toThrow();
  });
});
