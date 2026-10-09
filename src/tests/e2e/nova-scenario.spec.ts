import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { NOVA_SCENARIO as S } from "../../lib/learning/scenarios/nova";
import type { Exercise } from "../../lib/learning/schema";

/**
 * Scénario Nova jouable de bout en bout : parcours du paiement, frontière de
 * connaissance, perspectives d'observateur, branches et débriefing.
 */
const URL = "/lab/crypto-flux/scenario";
const PARCOURS = S.steps.findIndex((s) => s.marker === "Parcours");

/** Cartes du parcours animé : une par opération, puis la carte finale (frontière ou bénéficiaire). */
const hopsOf = (page: Page) => page.locator('ol[aria-label="Opérations du paiement"] > li');

async function answerCorrectly(page: Page, exercise: Exercise) {
  for (const o of exercise.options.filter((x) => x.verdict === "juste")) {
    await page.getByLabel(o.label, { exact: true }).check();
  }
  await page.getByRole("button", { name: "Valider ma réponse" }).click();
  await expect(page.getByText("Réponse juste", { exact: true })).toBeVisible();
}

/** Joue les étapes jusqu'à l'index donné (exclu), en répondant juste. */
async function playUntil(page: Page, stop: number) {
  for (let i = 0; i < stop; i++) {
    const step = S.steps[i];
    await expect(page.getByRole("heading", { name: step.title, level: 2 })).toBeVisible();
    if (step.exercise) await answerCorrectly(page, step.exercise);
    const next = i < S.steps.length - 1 ? `Étape suivante : ${S.steps[i + 1].marker}` : "Recevoir les pièces";
    await page.getByRole("button", { name: next }).click();
  }
}

test("l'introduction du parcours Nova mène au scénario", async ({ page }) => {
  await page.goto("/lab/crypto-flux");
  await page.getByRole("link", { name: "Commencer le scénario" }).click();
  await expect(page).toHaveURL(URL);
  await expect(page.getByRole("heading", { name: S.title, level: 1 })).toBeVisible();
  await expect(page.getByRole("note").getByText("Cas fictif, formation.")).toBeVisible();
});

test("le parcours animé avance opération par opération et s'arrête à la frontière", async ({ page }) => {
  await page.goto(URL);
  await playUntil(page, PARCOURS);
  await page.getByRole("tab", { name: "Parcours animé" }).click();

  const hops = hopsOf(page);
  await expect(hops).toHaveCount(6);
  // Montants exacts, dans leur unité, sans conversion.
  await expect(hops.nth(0)).toContainText("50 000,00 €");
  await expect(hops.nth(2)).toContainText("0,0021 ALPHA");

  // Rien ne bouge sans commande ; « Suivant » avance d'une opération.
  await expect(hops.nth(0)).toHaveAttribute("aria-current", "step");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Opération suivante" }).click();
  await expect(hops.nth(5)).toHaveAttribute("aria-current", "step");
  await expect(hops.nth(5)).toContainText("Frontière de connaissance");
  await expect(page.getByRole("button", { name: "Rejouer" })).toBeVisible();

  // Une perspective simulée estompe ce que l'observateur ne voit pas.
  await page.getByLabel("Perspective").selectOption({ label: "Banque A" });
  await expect(hops.filter({ hasText: "Invisible pour Banque A" })).toHaveCount(4);
});

test("en mouvement réduit, la lecture avance sans animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL);
  await playUntil(page, PARCOURS);
  await page.getByRole("tab", { name: "Parcours animé" }).click();
  await page.getByLabel("Vitesse").selectOption("rapide");
  await page.getByRole("button", { name: "Lecture" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.locator(".flow-dot")).toHaveCount(0);
  const hops = hopsOf(page);
  await expect(hops.nth(5)).toHaveAttribute("aria-current", "step", { timeout: 15_000 });
});

test("les perspectives comparent ce que voit chaque observateur", async ({ page }) => {
  await page.goto(URL);
  await playUntil(page, PARCOURS);
  await page.getByRole("tab", { name: "Perspectives" }).click();
  const table = page.getByRole("table", { name: "Opérations visibles par observateur" });
  await expect(table).toBeVisible();
  await expect(table.getByText("Ne voit pas").first()).toBeVisible();
  for (const o of S.observers) await expect(table.getByRole("columnheader", { name: o.label })).toBeVisible();
});

test("le scénario se joue jusqu'aux deux débriefings et s'exporte", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(URL);
  await playUntil(page, S.steps.length);

  const [branchA, branchB] = S.branches;
  await page.getByRole("button", { name: new RegExp(branchB.label) }).click();
  await expect(page.getByRole("heading", { name: branchB.label, level: 2 })).toBeVisible();
  await answerCorrectly(page, branchB.exercise!);
  await page.getByRole("button", { name: "Voir le débriefing" }).click();

  const total = S.steps.filter((s) => s.exercise).length + 1;
  await expect(page.getByText("Débriefing", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quatre niveaux, à ne pas confondre" })).toBeVisible();
  await expect(page.getByText(`${total} justes, 0 partielle, 0 à revoir, sur ${total} exercices.`)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter le carnet (.md)" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^carnet-paiement-nova-\d{4}-\d{2}-\d{2}\.md$/);
  const md = await readFile((await download.path())!, "utf8");
  expect(md).toContain("Cas fictif, formation.");
  expect(md).toContain(branchB.label);
  expect(md).toContain("## Sources de référence");
  expect(md).toContain(`Frontière de connaissance : ${branchB.boundary}`);

  // Branche A : le reversement à Lumen apparaît et le parcours va jusqu'au bénéficiaire.
  await page.getByRole("button", { name: /Jouer l'autre suite/ }).click();
  await expect(page.getByRole("heading", { name: branchA.label, level: 2 })).toBeVisible();
  await page.getByRole("tab", { name: "Parcours animé" }).click();
  await expect(page.getByText("Parcours documenté jusqu'au bénéficiaire.")).toBeVisible();
  await page.getByRole("tab", { name: "Graphe à couches" }).click();
  await expect(page.getByRole("button", { name: /^Mouvement : Kappa Payments, 49 600,75 €, Lumen Studio/ })).toBeVisible();
});

test("l'écran du scénario Nova ne déborde pas sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(URL);
  await expect(page.getByRole("heading", { name: S.steps[0].title, level: 2 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
