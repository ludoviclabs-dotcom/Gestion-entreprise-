import { test, expect } from "@playwright/test";

/**
 * Sélection et cadrage du graphe (cadrage §1.2 étapes 4 et 5) :
 *  - un clic sur un nœud ouvre sa fiche (régression : la capture du pointeur
 *    re-ciblait le pointerup sur le <svg> et refermait la fiche) ;
 *  - un nœud s'ouvre aussi au clavier (Tab puis Entrée) ;
 *  - un clic dans la fiche ne la referme pas ;
 *  - aucun libellé ne sort du cadre dans la vue initiale.
 */

async function waitForGraph(page: import("@playwright/test").Page) {
  await page.goto("/cases/demo-holding/graphe");
  await page.waitForSelector("svg.graph-svg .node", { state: "attached", timeout: 30_000 });
  // Laisse l'animation d'apparition et la physique se stabiliser.
  await page.waitForTimeout(2_000);
}

test("un clic sur un nœud ouvre sa fiche, qui reste ouverte", async ({ page }) => {
  await waitForGraph(page);
  const node = page.locator("svg.graph-svg .node").first();
  const label = (await node.getAttribute("aria-label"))!.replace(/ : ouvrir la fiche$/, "");

  const box = (await node.locator("circle").nth(2).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const panel = page.locator("aside").filter({ has: page.getByRole("button", { name: "Fermer" }) });
  await expect(panel.getByRole("heading", { name: label, exact: true })).toBeVisible();

  // Cliquer dans la fiche ne la referme pas.
  await panel.getByRole("heading", { name: label, exact: true }).click();
  await expect(panel.getByRole("heading", { name: label, exact: true })).toBeVisible();

  await panel.getByRole("button", { name: "Fermer" }).click();
  await expect(panel).toHaveCount(0);
});

test("un nœud s'ouvre au clavier", async ({ page }) => {
  await waitForGraph(page);
  const node = page.locator("svg.graph-svg .node").first();
  const label = (await node.getAttribute("aria-label"))!.replace(/ : ouvrir la fiche$/, "");
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
});

test("aucun libellé de nœud n'est coupé dans la vue initiale", async ({ page }) => {
  await waitForGraph(page);
  const overflow = await page.evaluate(() => {
    const svg = document.querySelector("svg.graph-svg")!;
    const frame = svg.getBoundingClientRect();
    const out: string[] = [];
    svg.querySelectorAll("text.lbl").forEach((t) => {
      const r = t.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.left < frame.left - 1 || r.right > frame.right + 1 || r.top < frame.top - 1 || r.bottom > frame.bottom + 1) {
        out.push(t.textContent ?? "");
      }
    });
    return out;
  });
  expect(overflow).toEqual([]);
});
