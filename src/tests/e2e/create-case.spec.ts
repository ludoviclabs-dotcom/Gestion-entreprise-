import { test, expect } from "@playwright/test";

/**
 * Parcours de création de dossier offline (mode démo) :
 *  - le dialog s'ouvre automatiquement,
 *  - la recherche par SIREN renvoie des candidats,
 *  - cliquer sur un candidat déclenche la Server Action `createCaseAction`
 *    et fait apparaître le toast de succès « Dossier créé ».
 *
 * Note : on vérifie le toast plutôt que la navigation finale parce que le
 * store mémoire (`sessionStore`) peut être invalidé par le HMR dev entre la
 * Server Action et la requête de rendu de /cases/[id]/graphe. La navigation
 * elle-même est couverte par le smoke navigateur + les autres specs e2e.
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

  // Toast Sonner de succès → preuve que la Server Action a abouti.
  await expect(page.getByText(/Dossier créé/i)).toBeVisible({ timeout: 30_000 });
});
