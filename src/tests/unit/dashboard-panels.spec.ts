import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewQueuePanel from "@/components/dashboard/ReviewQueuePanel.client";
import RiskSignalsPanel from "@/components/dashboard/RiskSignalsPanel";
import RecentActivityPanel from "@/components/dashboard/RecentActivityPanel";
import NextActionBanner from "@/components/dashboard/NextActionBanner";
import QuickAccessPanel from "@/components/dashboard/QuickAccessPanel";
import { buildReviewQueue, nextAction, summarizeSignals } from "@/lib/dashboard/portfolio";
import type { CaseSummary } from "@/lib/data/types";

/**
 * Panneaux du tableau de bord : états vide / rempli, libellés écrits à côté
 * de chaque teinte, liens vers l'onglet où agir.
 */

function summary(overrides: Partial<CaseSummary>): CaseSummary {
  return {
    id: "case-a",
    title: "Case A",
    rootSiren: "123456789",
    status: "ready",
    origin: "live",
    scoreStatus: "computed",
    sourceHealth: { origin: "live", total: 2, live: 2, fixture: 0, failed: 0 },
    scores: { complexite: 10, vigilance: 20, qualitePreuve: 90 },
    counts: { entities: 3, edges: 2, signalsHigh: 0 },
    lastRunAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("ReviewQueuePanel", () => {
  it("portefeuille vide : invitation à créer un dossier", () => {
    const out = html(h(ReviewQueuePanel, { queue: [], totalCases: 0 }));
    expect(out).toContain("Aucun dossier pour l&#x27;instant");
    expect(out).toContain('href="/cases/new"');
    expect(out).not.toContain('data-slot="segmented-control"');
  });

  it("rien à revoir : état « succès » écrit, sans filtre", () => {
    const out = html(h(ReviewQueuePanel, { queue: [], totalCases: 4 }));
    expect(out).toContain("Aucun dossier à revoir");
    expect(out).not.toContain('data-slot="segmented-control"');
  });

  it("file remplie : rang, raisons écrites, lien vers l'onglet cible, filtres comptés", () => {
    const queue = buildReviewQueue([
      summary({ id: "h", title: "Holding X", counts: { entities: 4, edges: 3, signalsHigh: 2 } }),
      summary({ id: "s", title: "SCI Y", sourceHealth: { origin: "live", total: 2, live: 2, fixture: 0, failed: 1 } }),
    ]);
    const out = html(h(ReviewQueuePanel, { queue, totalCases: 2 }));
    expect(out).toContain("Holding X");
    expect(out).toContain("2 signaux élevés");
    expect(out).toContain("1 source en échec");
    expect(out).toContain('href="/cases/h/risques"');
    expect(out).toContain('href="/cases/s/sources"');
    expect(out).toContain("Signaux · 1");
    expect(out).toContain("Sources · 1");
    // Filtre sans résultat : désactivé (état « désactivé » visible).
    expect(out).toMatch(/disabled=""[^>]*>Scores · 0/);
  });
});

describe("RiskSignalsPanel", () => {
  it("aucun signal élevé : le dit, sans prétendre à l'absence de risque", () => {
    const out = html(h(RiskSignalsPanel, { signals: summarizeSignals([summary({})]), totalCases: 1 }));
    expect(out).toContain("Aucun signal de sévérité élevée");
    expect(out).toContain("ne remplace pas la lecture des sources");
  });

  it("signaux : par dossier (lien risques) et par famille, chaque teinte doublée d'un nombre écrit", () => {
    const signals = summarizeSignals([
      summary({
        id: "b",
        title: "B",
        counts: { entities: 1, edges: 0, signalsHigh: 3 },
        signalsByFamilySeverity: { sanctions: { high: 2, medium: 1 } },
      }),
    ]);
    const out = html(h(RiskSignalsPanel, { signals, totalCases: 2 }));
    expect(out).toContain("3 élevés");
    expect(out).toContain('href="/cases/b/risques"');
    expect(out).toContain("Sanctions &amp; PEP");
    expect(out).toContain("2 élevés · 1 modéré");
    expect(out).toContain("(sur 2)");
  });
});

describe("RecentActivityPanel · NextActionBanner · QuickAccessPanel", () => {
  it("activité : date relative + date exacte (time datetime)", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const out = html(
      h(RecentActivityPanel, {
        items: [summary({ id: "r", title: "Récent", updatedAt: "2026-10-10T09:00:00Z" })],
        updatedInWindow: 1,
        now,
      }),
    );
    expect(out).toContain('dateTime="2026-10-10T09:00:00Z"');
    expect(out).toContain("il y a 3 heures");
    expect(out).toContain("1 mis à jour · 7 j");
  });

  it("activité vide : état vide", () => {
    const out = html(h(RecentActivityPanel, { items: [], updatedInWindow: 0, now: new Date() }));
    expect(out).toContain("Aucune activité");
  });

  it("prochaine action : titre, contexte et bouton vers l'onglet", () => {
    const queue = buildReviewQueue([
      summary({ id: "h", title: "Holding X", counts: { entities: 1, edges: 0, signalsHigh: 1 } }),
    ]);
    const out = html(h(NextActionBanner, { action: nextAction(queue, 1) }));
    expect(out).toContain("Prochaine action");
    expect(out).toContain("Instruire 1 signal élevé");
    expect(out).toContain('href="/cases/h/risques"');
    expect(out).toContain("Ouvrir les risques");
  });

  it("accès rapides : Dossiers, Transactions, Secteurs 2026, Réglages", () => {
    const out = html(h(QuickAccessPanel));
    for (const href of ["/cases", "/transactions", "/secteurs", "/reglages"]) {
      expect(out).toContain(`href="${href}"`);
    }
    expect(out).not.toContain('href="/dashboard"');
  });
});
