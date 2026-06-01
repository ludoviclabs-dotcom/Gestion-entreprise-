import { test, expect } from "@playwright/test";

/**
 * Smoke test du graphe de démonstration :
 *  - la page workspace charge,
 *  - le canvas Sigma est monté,
 *  - les couches sont togglables,
 *  - un clic sur le bouton « Recentrer » ne casse rien.
 */
test("le dossier de démonstration affiche le graphe et permet le toggle des couches", async ({
  page,
}) => {
  await page.goto("/cases/demo-holding/graphe");

  // En-tête du workspace présent.
  await expect(page.getByRole("heading", { name: /Holding Patrimoniale/i })).toBeVisible();

  // Onglets workspace présents.
  await expect(page.getByRole("link", { name: "Graphe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Risques" })).toBeVisible();

  // Sigma rend un <canvas> dans le conteneur. On attend au moins l'un d'eux.
  await page.waitForSelector("canvas", { state: "attached", timeout: 15_000 });
  expect(await page.locator("canvas").count()).toBeGreaterThan(0);

  // Toolbar : bouton Recentrer.
  await page.getByRole("button", { name: "Recentrer" }).click();

  // Toolbar : ouvrir le popover Couches + désactiver "Capital".
  await page.getByRole("button", { name: "Couches" }).click();
  await page.getByRole("button", { name: /Capital/i }).click();

  // La page reste fonctionnelle après les interactions (pas de crash).
  await expect(page.getByRole("link", { name: "Graphe" })).toBeVisible();
});
