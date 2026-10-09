import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { ASTER_SCENARIO as S } from "../../lib/learning/scenarios/aster";
import type { Exercise } from "../../lib/learning/schema";

/**
 * Scénario Aster jouable de bout en bout : étapes T0 à T4, hypothèses,
 * vérifications, branche, débriefing et export du carnet.
 */
const URL = "/lab/controle-actifs/scenario";

async function answerCorrectly(page: Page, exercise: Exercise) {
  for (const o of exercise.options.filter((x) => x.verdict === "juste")) {
    await page.getByLabel(o.label, { exact: true }).check();
  }
  await page.getByRole("button", { name: "Valider ma réponse" }).click();
  await expect(page.getByText("Réponse juste", { exact: true })).toBeVisible();
}

test("l'introduction du parcours mène au scénario", async ({ page }) => {
  await page.goto("/lab/controle-actifs");
  await page.getByRole("link", { name: "Commencer le scénario" }).click();
  await expect(page).toHaveURL(URL);
  await expect(page.getByRole("heading", { name: "Aster Photonique", level: 1 })).toBeVisible();
  await expect(page.getByRole("note").getByText("Cas fictif, formation.")).toBeVisible();
});

test("on ne passe à l'étape suivante qu'après avoir répondu", async ({ page }) => {
  await page.goto(URL);
  const next = page.getByRole("button", { name: /Étape suivante : T1/ });
  await expect(next).toBeDisabled();
  await page.getByLabel(S.steps[0].exercise!.options.find((o) => o.verdict === "faux")!.label, { exact: true }).check();
  await page.getByRole("button", { name: "Valider ma réponse" }).click();
  await expect(page.getByText("Réponse à revoir", { exact: true })).toBeVisible();
  await expect(page.getByText("Lecture argumentée")).toBeVisible();
  await expect(next).toBeEnabled();
});

test("le scénario se joue jusqu'au débriefing de la branche B et s'exporte", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(URL);
  for (const [i, step] of S.steps.entries()) {
    await expect(page.getByRole("heading", { name: step.title, level: 2 })).toBeVisible();
    if (step.exercise) await answerCorrectly(page, step.exercise);
    const next = i < S.steps.length - 1 ? `Étape suivante : ${S.steps[i + 1].marker}` : "Recevoir les pièces";
    await page.getByRole("button", { name: next }).click();
  }

  const branchB = S.branches.find((b) => b.id === "branche-b")!;
  await page.getByRole("button", { name: new RegExp(branchB.label) }).click();
  await expect(page.getByRole("heading", { name: branchB.label, level: 2 })).toBeVisible();
  await answerCorrectly(page, branchB.exercise!);
  await page.getByRole("button", { name: "Voir le débriefing" }).click();

  await expect(page.getByText("Débriefing", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: branchB.label, level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quatre niveaux, à ne pas confondre" })).toBeVisible();
  await expect(page.getByText("8 justes, 0 partielle, 0 à revoir, sur 8 exercices.")).toBeVisible();

  // La relation propre à la branche apparaît dans la vue tableau du graphe.
  await page.getByRole("button", { name: "Afficher en tableau" }).click();
  await expect(page.getByRole("button", { name: /Accès : ouverture non autorisée/ })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter le carnet (.md)" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^carnet-aster-photonique-\d{4}-\d{2}-\d{2}\.md$/);
  const md = await readFile((await download.path())!, "utf8");
  expect(md).toContain("Cas fictif, formation.");
  expect(md).toContain("## Conclusion");

  // L'autre branche se joue depuis le débriefing.
  await page.getByRole("button", { name: /Jouer l'autre suite/ }).click();
  await expect(page.getByRole("heading", { name: S.branches[0].label, level: 2 })).toBeVisible();
});

test("le graphe se parcourt au clavier et alimente l'inspecteur", async ({ page }) => {
  await page.goto(URL);
  const node = page.getByRole("button", { name: /^Aster Photonique, Entreprise/ });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(node).toHaveAttribute("aria-pressed", "true");
  const inspector = page.getByRole("region", { name: "Inspecteur" });
  await expect(inspector.getByRole("heading", { name: "Aster Photonique", level: 3 })).toBeVisible();
  await expect(inspector.getByText("Relations à cette date")).toBeVisible();
});

test("l'écran de scénario ne déborde pas sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(URL);
  await expect(page.getByRole("heading", { name: S.steps[0].title, level: 2 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
