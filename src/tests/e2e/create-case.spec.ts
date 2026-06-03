import { test, expect } from "@playwright/test";

/**
 * Parcours de création de dossier offline (mode démo) :
 *  - le dialog s'ouvre automatiquement,
 *  - la recherche par SIREN renvoie des candidats,
 *  - cliquer sur un candidat déclenche la Server Action `createCaseAction`
 *    qui renvoie l'id du dossier, puis `window.location.assign` navigue vers
 *    /cases/[id]/graphe.
 *
 * On asserte la *requête de navigation* vers /cases/<uuid>/graphe (et non plus
 * le toast « Dossier créé », ni l'URL committée). La navigation est un
 * hard-redirect via window.location.assign : le toast n'a pas le temps de
 * s'afficher, et attendre l'URL committée dépendrait du temps de compilation
 * de la route lourde /graphe (Sigma + graphology) — lent et flaky sous le dev
 * server CI à froid. La requête document, elle, part *immédiatement* après le
 * succès de la Server Action : la capter prouve que l'action a renvoyé un id
 * ET que le redirect s'est déclenché, sans attendre le rendu de la cible.
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

  // Armé AVANT le clic : capte la requête document émise par
  // window.location.assign dès le succès de la Server Action, indépendamment
  // du temps de compilation de la route cible.
  // Id accepté large : UUID en mode DB (hex) OU slug fixture `s-<siren>-<n>`
  // en mode démo. `[^/]+` couvre les deux sans présumer du format.
  const navRequest = page.waitForRequest(
    (req) =>
      req.isNavigationRequest() && /\/cases\/[^/]+\/graphe/i.test(req.url()),
    { timeout: 30_000 },
  );

  await candidate.first().click();

  const req = await navRequest;
  expect(req.url()).toMatch(/\/cases\/[^/]+\/graphe/i);
});
