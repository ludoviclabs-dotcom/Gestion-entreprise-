import { test, expect } from "@playwright/test";

/**
 * Vérifie que les 4 onglets du workspace (Graphe / Timeline / Risques /
 * Sources) sont accessibles via URL et changent bien le contenu rendu.
 */
test("navigation entre les 4 onglets d'un dossier", async ({ page }) => {
  const caseId = "demo-holding";

  // Onglet Graphe (point d'entrée).
  await page.goto(`/cases/${caseId}/graphe`);
  await expect(page.getByRole("heading", { name: /Holding Patrimoniale/i })).toBeVisible();
  await page.waitForSelector("canvas", { state: "attached", timeout: 15_000 });

  // Onglet Timeline.
  await page.getByRole("link", { name: "Timeline" }).click();
  await page.waitForURL(`**/cases/${caseId}/timeline`);
  await expect(page.getByRole("heading", { name: /Timeline juridique/i })).toBeVisible();

  // Onglet Risques.
  await page.getByRole("link", { name: "Risques" }).click();
  await page.waitForURL(`**/cases/${caseId}/risques`);
  await expect(page.getByRole("heading", { name: /Signaux de vigilance/i })).toBeVisible();

  // Onglet Sources.
  await page.getByRole("link", { name: "Sources" }).click();
  await page.waitForURL(`**/cases/${caseId}/sources`);
  await expect(page.getByRole("heading", { name: /Sources/i })).toBeVisible();

  // Journal de preuve (Étape 3.4) : seedé en démo, chaîne intègre.
  await expect(
    page.getByRole("heading", { name: "Journal de preuve" }),
  ).toBeVisible();
  await expect(page.getByText("Chaîne vérifiée")).toBeVisible();
  await expect(page.getByText("Dossier créé").first()).toBeVisible();

  // Retour à Graphe.
  await page.getByRole("link", { name: "Graphe" }).click();
  await page.waitForURL(`**/cases/${caseId}/graphe`);
  await page.waitForSelector("canvas", { state: "attached" });
});
