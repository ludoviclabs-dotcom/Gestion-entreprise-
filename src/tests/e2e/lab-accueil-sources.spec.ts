import { test, expect } from "@playwright/test";

/**
 * Accueil du Lab, fiches sources et recherche d'objet dans le graphe
 * (cadrage §9.1 et §12.3, « Interface »).
 */
test("l'accueil du Lab présente les deux parcours et mène directement aux scénarios", async ({ page }) => {
  await page.goto("/lab");
  await expect(page.getByRole("note").getByText("Cas fictif, formation.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parcours guidés" })).toBeVisible();
  await expect(page.getByText("Premier parcours conseillé, sans prérequis.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Commencer le scénario Aster Photonique" })).toHaveAttribute(
    "href",
    "/lab/controle-actifs/scenario",
  );
  await page.getByRole("link", { name: "Commencer le scénario Le paiement de Nova" }).click();
  await expect(page).toHaveURL("/lab/crypto-flux/scenario");
});

test("les fiches sources donnent dates, limites, revue et renvoient aux notions", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("link", { name: "Voir les fiches sources" }).click();
  await expect(page).toHaveURL("/lab/sources");
  await expect(page.getByRole("heading", { name: "Fiches sources", level: 1 })).toBeVisible();

  const sheet = page.locator("#source-cmf-r561-1");
  await expect(sheet.getByRole("heading", { name: /article R\. 561-1/ })).toBeVisible();
  await expect(sheet).toContainText("Consultée le09/10/2026");
  await expect(sheet).toContainText("trimestrielle, à relire avant le 09/01/2027");
  await sheet.getByRole("link", { name: "Bénéficiaire effectif" }).click();
  await expect(page).toHaveURL("/lab/controle-actifs#notion-beneficiaire-effectif");

  // Depuis la notion, la fiche de la source s'ouvre à son ancre.
  await page
    .locator("#notion-beneficiaire-effectif")
    .getByRole("link", { name: /fiche de la source Code monétaire et financier/ })
    .click();
  await expect(page).toHaveURL("/lab/sources#source-cmf-r561-1");
  await expect(page.locator("#source-dgsi-flash-ingerence")).toContainText("mensuelle");
});

test("un objet se retrouve dans le graphe et s'ouvre dans l'inspecteur", async ({ page }) => {
  await page.goto("/lab/controle-actifs/scenario");
  await page.getByLabel("Trouver un objet").selectOption({ label: "Claire Vidal" });
  await expect(page.getByRole("button", { name: /^Claire Vidal,/ })).toHaveAttribute("aria-pressed", "true");
  const inspector = page.getByRole("region", { name: "Inspecteur" });
  await expect(inspector.getByRole("heading", { name: "Claire Vidal", level: 3 })).toBeVisible();
});

test("les fiches sources ne débordent pas sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const url of ["/lab", "/lab/sources"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
