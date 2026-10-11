import { test, expect } from "@playwright/test";

/**
 * Tableau de bord + coque applicative (mode démo, fixtures) : les quatre
 * questions trouvent leur réponse sans défilement horizontal, au clavier comme
 * à la souris, du mobile au desktop.
 */

test("le tableau de bord répond aux quatre questions", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();

  // 1. Dossiers à revoir + 2. signaux élevés : deux régions nommées.
  await expect(page.getByRole("region", { name: "Dossiers à revoir" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Signaux de sévérité élevée" })).toBeVisible();
  // 3. Prochaine action : une phrase et un lien d'action.
  const next = page.getByRole("region", { name: /Instruire|Vérifier|Examiner|Compléter|Aucune revue|Créer/ });
  await expect(next).toBeVisible();
  await expect(next.getByRole("link")).toBeVisible();
  // 4. Où trouver le reste : accès rapides.
  const quick = page.getByRole("region", { name: "Accès rapides" });
  for (const name of ["Dossiers", "Transactions", "Secteurs 2026", "Réglages"]) {
    await expect(quick.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
});

test("navigation principale : entrée active, compteur lu, flèches du clavier", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: /Dossiers.*à revoir/ })).toBeVisible();

  await nav.getByRole("link", { name: "Tableau de bord" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(nav.getByRole("link", { name: /^Dossiers/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(nav.getByRole("link", { name: "Réglages" })).toBeFocused();
});

test("recherche globale : Ctrl+K ouvre la palette, qui mène aux pages", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /Recherche globale/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Control+K Meta+K",
  );
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Recherche globale" });
  await expect(dialog).toBeVisible();
  await page.keyboard.type("transactions");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/transactions$/);
});

for (const width of [390, 900]) {
  test(`aucun débordement horizontal du tableau de bord à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const main = document.querySelector("main");
      return {
        doc: document.documentElement.scrollWidth - window.innerWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
      };
    });
    expect(overflow.doc).toBeLessThanOrEqual(0);
    expect(overflow.main).toBeLessThanOrEqual(0);
  });
}

test("mobile : le tiroir de navigation garde les libellés complets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  for (const name of ["Tableau de bord", "Transactions", "Secteurs 2026", "Réglages"]) {
    await expect(drawer.getByRole("link", { name })).toBeVisible();
  }
});
