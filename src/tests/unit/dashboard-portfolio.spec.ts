import { describe, expect, it } from "vitest";
import {
  buildReviewQueue,
  computePortfolioKpis,
  nextAction,
  proofQualityStatus,
  recentActivity,
  reviewReasons,
  summarizeSignals,
} from "@/lib/dashboard/portfolio";
import { APP_NAV, isNavActive } from "@/components/shell/nav";
import type { CaseSummary } from "@/lib/data/types";

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

describe("computePortfolioKpis — calculs historiques du tableau de bord conservés", () => {
  const cases = [
    summary({ id: "a", counts: { entities: 5, edges: 4, signalsHigh: 2 }, scores: { qualitePreuve: 80 } }),
    summary({ id: "b", status: "enriching", counts: { entities: 7, edges: 6, signalsHigh: 0 }, scores: { qualitePreuve: 65 } }),
    summary({ id: "c", status: "draft", counts: { entities: 1, edges: 0, signalsHigh: 3 }, scores: {} }),
  ];

  it("reproduit les formules de l'ancienne page (somme, moyenne arrondie sur les dossiers scorés)", () => {
    const k = computePortfolioKpis(cases);
    // Ancienne page : totalCompanies, totalHigh, avgProof — mêmes formules.
    const legacyEntities = cases.reduce((n, c) => n + c.counts.entities, 0);
    const legacyHigh = cases.reduce((n, c) => n + c.counts.signalsHigh, 0);
    const withProof = cases.filter((c) => c.scores.qualitePreuve !== undefined);
    const legacyAvg = Math.round(
      withProof.reduce((n, c) => n + (c.scores.qualitePreuve ?? 0), 0) / withProof.length,
    );
    expect(k.entities).toBe(legacyEntities);
    expect(k.signalsHigh).toBe(legacyHigh);
    expect(k.avgProof).toBe(legacyAvg);
    expect(k.avgProof).toBe(73); // (80 + 65) / 2 = 72,5 → 73
    expect(k.proofScored).toBe(2);
  });

  it("ventile les statuts et compte les dossiers à signaux élevés", () => {
    const k = computePortfolioKpis(cases);
    expect(k.cases).toBe(3);
    expect(k.byStatus).toEqual({ draft: 1, enriching: 1, ready: 1, error: 0 });
    expect(k.casesWithHigh).toBe(2);
    expect(k.edges).toBe(10);
  });

  it("portefeuille vide : zéros, sans division par zéro", () => {
    const k = computePortfolioKpis([]);
    expect(k).toMatchObject({ cases: 0, signalsHigh: 0, avgProof: 0, proofScored: 0, entities: 0 });
  });

  it("la qualité de preuve se lit avec un libellé (seuils 34 / 67) — « Aucun dossier scoré » sans donnée", () => {
    expect(proofQualityStatus(73, 2)).toEqual({ tone: "success", label: "Bonne" });
    expect(proofQualityStatus(50, 2)).toEqual({ tone: "vigilance", label: "Moyenne" });
    expect(proofQualityStatus(20, 2)).toEqual({ tone: "critical", label: "Faible" });
    expect(proofQualityStatus(0, 0)).toEqual({ tone: "neutral", label: "Aucun dossier scoré" });
  });
});

describe("buildReviewQueue — ordre de traitement, raisons écrites", () => {
  it("un dossier sans raison n'entre pas dans la file", () => {
    expect(reviewReasons(summary({}))).toEqual([]);
    expect(buildReviewQueue([summary({})])).toEqual([]);
  });

  it("raisons : signaux élevés, vigilance ≥ 67, sources en échec, score incomplet — avec libellés", () => {
    const reasons = reviewReasons(
      summary({
        counts: { entities: 3, edges: 2, signalsHigh: 2 },
        scores: { vigilance: 72 },
        sourceHealth: { origin: "live", total: 4, live: 4, fixture: 0, failed: 1 },
        scoreStatus: "partial",
      }),
    );
    expect(reasons.map((r) => r.kind)).toEqual([
      "signals_high",
      "vigilance_high",
      "sources_failed",
      "score_incomplete",
    ]);
    expect(reasons.map((r) => r.label)).toEqual([
      "2 signaux élevés",
      "Vigilance 72/100",
      "1 source en échec",
      "Score partiel",
    ]);
    // Toute raison a une teinte ET un libellé (jamais la couleur seule).
    for (const r of reasons) expect(r.label.length).toBeGreaterThan(0);
  });

  it("vigilance sous le seuil de 67 : pas une raison de revue", () => {
    expect(reviewReasons(summary({ scores: { vigilance: 66 } }))).toEqual([]);
  });

  it("trie signaux élevés > vigilance > sources > scoring ; égalité → le plus récent", () => {
    const queue = buildReviewQueue([
      summary({ id: "score", scoreStatus: "missing", updatedAt: "2026-06-05T00:00:00Z" }),
      summary({
        id: "sources",
        sourceHealth: { origin: "live", total: 3, live: 3, fixture: 0, failed: 2 },
      }),
      summary({ id: "vigilance", scores: { vigilance: 80 } }),
      summary({ id: "signals", counts: { entities: 1, edges: 0, signalsHigh: 1 } }),
      summary({ id: "score-old", scoreStatus: "missing", updatedAt: "2026-06-01T00:00:00Z" }),
    ]);
    expect(queue.map((i) => i.case.id)).toEqual([
      "signals",
      "vigilance",
      "sources",
      "score",
      "score-old",
    ]);
  });

  it("mène à l'onglet où agir : risques pour les signaux, sources pour les échecs", () => {
    const [signals] = buildReviewQueue([summary({ id: "x", counts: { entities: 1, edges: 0, signalsHigh: 4 } })]);
    expect(signals.href).toBe("/cases/x/risques");
    expect(signals.actionLabel).toBe("Ouvrir les risques");
    const [sources] = buildReviewQueue([
      summary({ id: "y", sourceHealth: { origin: "live", total: 2, live: 2, fixture: 0, failed: 1 } }),
    ]);
    expect(sources.href).toBe("/cases/y/sources");
  });
});

describe("buildReviewQueue — bandes de priorité disjointes", () => {
  it("un seul signal élevé passe devant tout cumul vigilance + sources + score", () => {
    const queue = buildReviewQueue([
      summary({
        id: "cumul",
        scores: { vigilance: 100 },
        sourceHealth: { origin: "live", total: 5, live: 5, fixture: 0, failed: 3 },
        scoreStatus: "partial",
      }),
      summary({ id: "signal", counts: { entities: 1, edges: 0, signalsHigh: 1 } }),
    ]);
    expect(queue.map((i) => i.case.id)).toEqual(["signal", "cumul"]);
    expect(nextAction(queue, 2).href).toBe("/cases/signal/risques");
  });

  it("même raison principale : l'ampleur départage (3 signaux > 1 signal + cumul secondaire)", () => {
    const queue = buildReviewQueue([
      summary({
        id: "un",
        counts: { entities: 1, edges: 0, signalsHigh: 1 },
        scores: { vigilance: 99 },
        sourceHealth: { origin: "live", total: 9, live: 9, fixture: 0, failed: 9 },
      }),
      summary({ id: "trois", counts: { entities: 1, edges: 0, signalsHigh: 3 } }),
    ]);
    expect(queue.map((i) => i.case.id)).toEqual(["trois", "un"]);
  });
});

describe("nextAction — une phrase, un bouton", () => {
  it("portefeuille vide → créer un premier dossier", () => {
    expect(nextAction([], 0)).toMatchObject({ kind: "create_first", href: "/cases/new" });
  });

  it("aucune revue en attente → l'écrit, teinte succès", () => {
    expect(nextAction([], 4)).toMatchObject({ kind: "clear", tone: "success", title: "Aucune revue en attente" });
  });

  it("sinon : la première raison du premier dossier de la file", () => {
    const queue = buildReviewQueue([
      summary({ id: "h", title: "Holding X", rootSiren: "552032534", counts: { entities: 1, edges: 0, signalsHigh: 3 } }),
    ]);
    expect(nextAction(queue, 1)).toEqual({
      kind: "review",
      title: "Instruire 3 signaux élevés",
      description: "Holding X · SIREN 552032534",
      href: "/cases/h/risques",
      cta: "Ouvrir les risques",
      tone: "critical",
    });
  });

  it("singulier correct", () => {
    const queue = buildReviewQueue([
      summary({ sourceHealth: { origin: "live", total: 2, live: 2, fixture: 0, failed: 1 } }),
    ]);
    expect(nextAction(queue, 1).title).toBe("Vérifier 1 source en échec");
  });
});

describe("summarizeSignals", () => {
  it("dossiers à signaux élevés (décroissant) et répartition par famille quand elle existe", () => {
    const overview = summarizeSignals([
      summary({ id: "a", title: "A", counts: { entities: 1, edges: 0, signalsHigh: 1 } }),
      summary({
        id: "b",
        title: "B",
        counts: { entities: 1, edges: 0, signalsHigh: 3 },
        signalsByFamilySeverity: { sanctions: { high: 2 }, adresse: { high: 1, medium: 2 } },
      }),
      summary({ id: "c", title: "C" }),
    ]);
    expect(overview.totalHigh).toBe(4);
    expect(overview.cases.map((r) => r.case.id)).toEqual(["b", "a"]);
    expect(overview.familiesCoverage).toBe(1);
    expect(overview.families.map((f) => [f.label, f.counts.high, f.total])).toEqual([
      ["Sanctions & PEP", 2, 2],
      ["Domiciliation", 1, 3],
    ]);
  });

  it("aucune répartition en base : liste vide, couverture 0 (le panneau le dit)", () => {
    const overview = summarizeSignals([summary({ counts: { entities: 1, edges: 0, signalsHigh: 2 } })]);
    expect(overview.families).toEqual([]);
    expect(overview.familiesCoverage).toBe(0);
  });
});

describe("recentActivity", () => {
  it("trie par mise à jour et compte les mises à jour des 7 derniers jours", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const { items, updatedInWindow } = recentActivity(
      [
        summary({ id: "old", updatedAt: "2026-09-01T00:00:00Z" }),
        summary({ id: "new", updatedAt: "2026-10-10T08:00:00Z" }),
        summary({ id: "mid", updatedAt: "2026-10-05T00:00:00Z" }),
      ],
      now,
      2,
    );
    expect(items.map((c) => c.id)).toEqual(["new", "mid"]);
    expect(updatedInWindow).toBe(2);
  });
});

describe("navigation principale — source unique", () => {
  it("les cinq entrées demandées, dans l'ordre", () => {
    expect(APP_NAV.map((i) => i.label)).toEqual([
      "Tableau de bord",
      "Dossiers",
      "Transactions",
      "Secteurs 2026",
      "Réglages",
    ]);
    for (const item of APP_NAV) {
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.shortLabel.length).toBeLessThanOrEqual(item.label.length);
    }
  });

  it("actif sur la route et ses sous-routes, jamais sur un préfixe", () => {
    expect(isNavActive("/cases", "/cases")).toBe(true);
    expect(isNavActive("/cases/abc/graphe", "/cases")).toBe(true);
    expect(isNavActive("/cases-archive", "/cases")).toBe(false);
    expect(isNavActive("/dashboard", "/cases")).toBe(false);
    expect(isNavActive(null, "/cases")).toBe(false);
  });
});
