import { test, expect, type Page } from "@playwright/test";

/**
 * Espace Transactions : import local d'un relevé de TEST (construit ici, jamais
 * affiché comme une donnée réelle), filtres conservés dans l'URL, détail avec
 * motif, action de revue, consultation mobile sans table.
 */

const CSV = [
  "date,contrepartie,montant,devise,iban",
  "2026-01-05,Loyer SCI,-1200,EUR,",
  "2026-02-05,Loyer SCI,-1200,EUR,",
  "2026-01-10,Fournisseur A,-95,EUR,FR7630006000011234567890189",
  "2026-01-12,Fournisseur B,-110,EUR,FR7630006000011234567890189",
  "2026-01-14,Fournisseur C,-102,EUR,",
  "2026-01-16,Fournisseur D,-98,EUR,",
  "2026-01-20,Prestataire Z,-48000,EUR,FR7630006000011234567890188",
  "2026-01-22,Client E,450,EUR,",
].join("\n");

async function importCsv(page: Page) {
  await page.locator('input[type="file"][aria-describedby$="-privacy"]').setInputFiles({
    name: "releve-test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV, "utf8"),
  });
}

test("import, filtres conservés dans l'URL et détail avec motif", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Importer un relevé de transactions" })).toBeVisible();
  // Avant import : action de revue désactivée.
  await expect(page.getByRole("button", { name: /Revoir les signalées/ })).toBeDisabled();

  await importCsv(page);
  const table = page.getByRole("region", { name: "Transactions importées" });
  await expect(table.getByRole("table")).toBeVisible();
  await expect(page.getByText(/8\s*transactions/).first()).toBeVisible();

  // Filtre « Signal : Doublon » → URL, puces, deux lignes.
  await page.getByLabel("Signal", { exact: true }).selectOption("duplicate");
  await expect(page).toHaveURL(/signal=duplicate/);
  await expect(page.getByRole("button", { name: "Retirer le filtre Signal : Doublon" })).toBeVisible();
  await expect(table.getByRole("button", { name: /^Ouvrir la transaction/ })).toHaveCount(2);

  // Détail : motif écrit, lien vers la transaction liée, source.
  await table.getByRole("button", { name: /ligne 2 : Loyer SCI/ }).click();
  const panel = page.getByRole("dialog", { name: "Loyer SCI" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/Motif/).first()).toBeVisible();
  await expect(panel.getByText("releve-test.csv · ligne 2")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Le filtre survit au rechargement (l'URL le porte) ; le fichier, lui, n'est pas conservé.
  await page.reload();
  await expect(page.getByText(/1 filtre enregistré/)).toBeVisible();
});

test("action de revue : signalées d'abord, la première ouverte", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/transactions");
  await importCsv(page);
  await page.getByRole("button", { name: /Revoir les signalées \(\d+\)/ }).click();
  await expect(page).toHaveURL(/risque=signalee/);
  await expect(page).toHaveURL(/tri=-risque/);
  // Prestataire Z : montant atypique + IBAN invalide → vigilance renforcée, en tête.
  await expect(page.getByRole("dialog", { name: "Prestataire Z" })).toBeVisible();
});

test("mobile : liste de consultation, aucun débordement horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transactions");
  await importCsv(page);
  const region = page.getByRole("region", { name: "Transactions importées" });
  await expect(region.getByRole("table")).toBeHidden();
  await expect(region.getByRole("button", { name: /Loyer SCI/ }).first()).toBeVisible();
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main ? main.scrollWidth - main.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("fichier sans montant : état d'erreur explicite", async ({ page }) => {
  await page.goto("/transactions");
  await page.locator('input[type="file"][aria-describedby$="-privacy"]').setInputFiles({
    name: "vide.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,nom\n2026-01-01,X\n", "utf8"),
  });
  await expect(page.locator('[data-slot="error-state"]')).toContainText("Aucune transaction exploitable");
  await expect(page.getByRole("button", { name: "Choisir un autre fichier" })).toBeVisible();
});
