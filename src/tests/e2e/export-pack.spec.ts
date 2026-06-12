import { test, expect } from "@playwright/test";

/**
 * Smoke test de l'Evidence Pack ZIP : la route GET renvoie un fichier
 * application/zip bien formé (magic bytes « PK\x03\x04 ») d'une taille
 * plausible (PDF + JSON + journal + script de vérification).
 */
test("export Evidence Pack ZIP du dossier de démonstration", async ({
  request,
}) => {
  const res = await request.get("/cases/demo-holding/export/pack");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/application\/zip/);
  expect(res.headers()["content-disposition"]).toMatch(/attachment/);
  const buffer = await res.body();
  expect(buffer.length).toBeGreaterThan(10_000);
  // ZIP magic bytes.
  expect(buffer[0]).toBe(0x50); // P
  expect(buffer[1]).toBe(0x4b); // K
  expect(buffer[2]).toBe(0x03);
  expect(buffer[3]).toBe(0x04);
});
