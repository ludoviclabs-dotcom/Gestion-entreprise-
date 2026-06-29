import { test, expect } from "@playwright/test";

test("le Lab est accessible depuis la navigation publique et lance Fraud Detective", async ({
  page,
}) => {
  await page.goto("/");
  const labNavLink = page.locator('header nav a[href="/lab"]');
  await expect(labNavLink).toBeVisible();

  await labNavLink.click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByRole("heading", { name: /Expériences pédagogiques/i })).toBeVisible();

  await page.locator('a[href="/lab/fraud-detective"]').first().click();
  await expect(page).toHaveURL(/\/lab\/fraud-detective$/);
  await expect(page.getByRole("heading", { name: "Fraud Detective" })).toBeVisible();

  await page.getByRole("button", { name: /Démarrer l'investigation/i }).click();
  await page.waitForSelector('[data-testid="fd-node"]', { state: "attached", timeout: 15_000 });

  await page.locator(".fd-node-core").first().click({ force: true });
  await expect(page.getByText(/Risque \d+\/100/)).toBeVisible();

  await page.getByRole("button", { name: /Soumettre verdict/i }).click();
  await expect(page.getByRole("heading", { name: /Investigation incomplète|Verdict validé/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Revoir la fraude/i })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Télécharger rapport/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^fraud-detective-CASE-\d{4}-\d{4}\.json$/);
});

test("le mode Expert affiche et décrémente la capacité d'analyse", async ({ page }) => {
  await page.goto("/lab/fraud-detective");
  await page.getByRole("button", { name: /Expert/i }).click();
  await page.getByRole("button", { name: /Démarrer l'investigation/i }).click();
  await page.waitForSelector('[data-testid="fd-node"]', { state: "attached", timeout: 15_000 });

  await expect(page.getByTestId("fd-capacity")).toHaveText("20");
  await page.locator(".fd-node-core").first().click({ force: true });
  await expect(page.getByTestId("fd-capacity")).toHaveText("19");
});
