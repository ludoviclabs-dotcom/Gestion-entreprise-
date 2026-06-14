import { test, expect } from "@playwright/test";

/**
 * Smoke test des pages publiques de crédibilité : chaque route répond 200,
 * affiche son titre et au moins une ancre réglementaire clé. Le footer public
 * relie les nouvelles pages depuis l'accueil.
 */
const PAGES = [
  {
    path: "/souverainete",
    heading: /hébergement souverain/i,
    anchor: /SecNumCloud/i,
  },
  { path: "/securite", heading: /Trust center/i, anchor: /SOC 2|ISO\/IEC 27001/i },
  {
    path: "/confidentialite",
    heading: /Protection des données/i,
    anchor: /5 ans/i,
  },
  { path: "/ressources", heading: /Ancrages réglementaires/i, anchor: /AMLR/i },
];

for (const p of PAGES) {
  test(`la page ${p.path} répond et affiche ses ancres`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: p.heading, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(p.anchor).first()).toBeVisible();
  });
}

test("le footer public (landmark contentinfo) relie les pages de crédibilité", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeVisible();
  for (const href of [
    "/souverainete",
    "/securite",
    "/confidentialite",
    "/ressources",
  ]) {
    await expect(footer.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
});
