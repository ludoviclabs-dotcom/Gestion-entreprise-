import { test, expect } from "@playwright/test";

/**
 * Inspecteur de preuve (onglet Sources) : un clic sur une ligne d'évidence
 * ouvre le drawer avec l'enregistrement source — endpoint fixture, empreinte
 * SHA-256 et payload brut.
 */
test("inspecteur de preuve sur le dossier de démonstration", async ({
  page,
}) => {
  await page.goto("/cases/demo-holding/sources");
  await expect(
    page.getByRole("heading", { name: "Journal de preuve" }),
  ).toBeVisible();

  await page.getByTestId("evidence-row").first().click();

  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByRole("heading", { name: "Inspecteur de preuve" }),
  ).toBeVisible();
  await expect(drawer.getByTestId("payload-hash")).toHaveText(/^[0-9a-f]{64}$/);
  await expect(drawer.getByText(/fixture:/).first()).toBeVisible();
});

/**
 * Lien « Voir la preuve » du panneau de nœud : atterrit sur l'onglet Sources
 * avec l'inspecteur ouvert sur le sujet sélectionné (?subject=).
 */
test("ouverture de l'inspecteur via ?subject=", async ({ page }) => {
  await page.goto("/cases/demo-holding/sources?subject=c1");
  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByRole("heading", { name: "Inspecteur de preuve" }),
  ).toBeVisible();
  await expect(drawer.getByText("HOLDING PATRIMONIALE SAS")).toBeVisible();
});
