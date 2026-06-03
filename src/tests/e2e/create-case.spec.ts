import { test, expect } from "@playwright/test";

/**
 * Parcours de création de dossier offline (mode démo) :
 *  - le dialog s'ouvre automatiquement,
 *  - la recherche par SIREN renvoie des candidats,
 *  - cliquer sur un candidat déclenche la Server Action `createCaseAction`
 *    qui renvoie l'id du dossier, puis `window.location.assign` navigue vers
 *    /cases/[id]/graphe.
 *
 * On asserte le changement d'URL (et non plus le toast « Dossier créé ») car
 * la navigation est désormais un hard-redirect immédiat : le toast n'a pas le
 * temps de s'afficher. L'URL `/cases/<uuid>/graphe` prouve à elle seule que la
 * Server Action a abouti (elle fournit l'id) ET que la navigation s'est
 * déclenchée — sans dépendre du rendu de la page de destination, que le
 * sessionStore mémoire peut invalider sous le dev server.
 */
test("création d'un dossier offline : recherche + succès Server Action", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/cases/new");

  // Le dialog s'ouvre via `defaultOpen`.
  await expect(page.getByRole("heading", { name: "Nouveau dossier" })).toBeVisible();

  // Recherche.
  await page.getByPlaceholder(/Nom ou SIREN/i).fill("552032534");
  await page.getByRole("button", { name: "Rechercher" }).click();

  // Candidat ciblé par son SIREN (sélecteur sans ambiguïté).
  const candidate = page.locator("button").filter({ hasText: "552032534" });
  await expect(candidate.first()).toBeVisible({ timeout: 20_000 });
  await candidate.first().click();

  // Navigation dure vers le dossier créé → preuve que la Server Action a
  // renvoyé un id et que le redirect s'est déclenché.
  await page.waitForURL(/\/cases\/[0-9a-f-]+\/graphe/i, { timeout: 30_000 });
  expect(page.url()).toMatch(/\/cases\/[0-9a-f-]+\/graphe/i);
});
