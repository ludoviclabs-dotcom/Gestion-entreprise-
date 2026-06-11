import { test, expect } from "@playwright/test";

/**
 * Smoke test de l'export PDF d'un dossier : la route GET renvoie un fichier
 * application/pdf bien formé (commence par "%PDF-"). Vérifie aussi que le
 * Content-Disposition force le téléchargement.
 */
test("export PDF du dossier de démonstration", async ({ request }) => {
  const res = await request.get("/cases/demo-holding/export/pdf");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/application\/pdf/);
  expect(res.headers()["content-disposition"]).toMatch(/attachment/);
  const buffer = await res.body();
  // PDF magic bytes : "%PDF-" en début de fichier.
  expect(buffer.length).toBeGreaterThan(2000);
  expect(buffer.slice(0, 5).toString("ascii")).toBe("%PDF-");
});

test("export JSON du dossier de démonstration", async ({ request }) => {
  const res = await request.get("/cases/demo-holding/export/json");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/application\/json/);
  const body = await res.json();
  expect(body.generator).toBe("KYB Graph");
  expect(body.payloadHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  expect(body.bundle.case.rootSiren).toBeDefined();
  expect(Array.isArray(body.sources)).toBe(true);
  expect(body.redaction).toBe("none");
});

test("export JSON anonymisé (?redact=persons) : aucun nom de personne", async ({
  request,
}) => {
  const res = await request.get(
    "/cases/demo-holding/export/json?redact=persons",
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.redaction).toBe("persons");
  const json = JSON.stringify(body.bundle);
  // « Jean MARTIN » est la personne du dossier de démonstration.
  expect(json).not.toContain("MARTIN");
  expect(json).toContain("Personne #1");
});
