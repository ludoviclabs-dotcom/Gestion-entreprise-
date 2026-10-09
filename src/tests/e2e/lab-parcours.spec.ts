import { test, expect } from "@playwright/test";

/**
 * Parcours guidés du Lab : les deux introductions répondent, portent le
 * bandeau de fiction et citent leurs sources ; le Lab y mène.
 */
const PATHS = [
  { slug: "controle-actifs", title: "Contrôle et actifs stratégiques", scenario: "Aster Photonique" },
  { slug: "crypto-flux", title: "Cryptoactifs et circulation des fonds", scenario: "Le paiement de Nova" },
];

for (const p of PATHS) {
  test(`le parcours ${p.slug} affiche son introduction`, async ({ page }) => {
    const res = await page.goto(`/lab/${p.slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: p.title, level: 1 })).toBeVisible();
    await expect(page.getByRole("note").getByText("Cas fictif, formation.")).toBeVisible();
    await expect(page.getByRole("heading", { name: p.scenario })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notions et sources" })).toBeVisible();
    // Au moins une source officielle liée.
    expect(await page.locator('a[href^="https://"][target="_blank"]').count()).toBeGreaterThan(2);
  });
}

test("le Lab mène aux deux parcours guidés", async ({ page }) => {
  await page.goto("/lab");
  for (const p of PATHS) {
    await expect(page.getByRole("link", { name: new RegExp(p.title) })).toHaveAttribute("href", `/lab/${p.slug}`);
  }
});
