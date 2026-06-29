import { describe, expect, it } from "vitest";
import {
  canInspectNode,
  computeRiskScore,
  createFraudReport,
  difficulties,
  evaluateVerdict,
  generateCase,
  riskTone,
} from "@/lib/fraud-detective/game";

describe("fraud detective case generation", () => {
  it("génère le motif prête-nom avec revenu personnel faible et détention à 100%", () => {
    const generated = generateCase("junior", { forcedPatternTypes: ["nominee"], nowYear: 2026 });
    const pattern = generated.patterns.find((item) => item.type === "nominee");
    expect(pattern).toBeDefined();

    const nominee = generated.nodes.find((node) => node.type === "person" && pattern?.items.includes(node.id));
    const company = generated.nodes.find((node) => node.type === "company" && pattern?.items.includes(node.id));
    const ownership = generated.edges.find((edge) => edge.type === "owns" && pattern?.items.includes(edge.id));

    expect(nominee?.declaredRevenue).toBeLessThan(5_000);
    expect(company?.revenue).toBeGreaterThan(1_000_000);
    expect(ownership?.percent).toBe(100);
  });

  it("génère le motif création groupée avec 3 sociétés, même date et même dirigeant", () => {
    const generated = generateCase("junior", { forcedPatternTypes: ["batch_creation"], nowYear: 2026 });
    const pattern = generated.patterns.find((item) => item.type === "batch_creation");
    expect(pattern).toBeDefined();

    const companies = generated.nodes.filter((node) => node.type === "company" && pattern?.items.includes(node.id));
    const dates = new Set(companies.map((company) => company.incorp));
    const directorships = generated.edges.filter((edge) => edge.type === "directs" && pattern?.items.includes(edge.id));
    const directors = new Set(directorships.map((edge) => (typeof edge.source === "string" ? edge.source : edge.source.id)));

    expect(companies).toHaveLength(3);
    expect(dates.size).toBe(1);
    expect(directors.size).toBe(1);
  });
});

describe("fraud detective scoring helpers", () => {
  it("calcule un halo rouge pour un prête-nom inspecté", () => {
    const generated = generateCase("junior", { forcedPatternTypes: ["nominee"], nowYear: 2026 });
    const pattern = generated.patterns[0]!;
    const nominee = generated.nodes.find((node) => node.type === "person" && pattern.items.includes(node.id));
    expect(nominee).toBeDefined();

    const score = computeRiskScore(nominee!, generated, 2026);
    expect(score).toBeGreaterThan(60);
    expect(riskTone(score)).toBe("red");
  });

  it("limite la capacité d'analyse en mode expert à 20 inspections", () => {
    expect(difficulties.expert.capacity).toBe(20);
    expect(canInspectNode("expert", 19)).toBe(true);
    expect(canInspectNode("expert", 20)).toBe(false);
    expect(canInspectNode("senior", 200)).toBe(true);
  });

  it("exporte un rapport JSON sérialisable avec verdict et flags", () => {
    const generated = generateCase("junior", { forcedPatternTypes: ["nominee"], nowYear: 2026 });
    const flaggedId = generated.patterns[0]!.items[0]!;
    const result = evaluateVerdict(generated, [flaggedId], "junior", 42, false);
    const report = createFraudReport({
      gameCase: generated,
      difficulty: "junior",
      score: result.score,
      flaggedIds: [flaggedId],
      verdict: result.verdict,
      totalTime: 90,
      timeLeft: 42,
      timestamp: "2026-06-29T12:00:00.000Z",
    });

    expect(report).toMatchObject({
      case_id: generated.caseId,
      timestamp: "2026-06-29T12:00:00.000Z",
      difficulty: "junior",
      verdict: "validé",
      time_elapsed: 48,
    });
    expect(report.flagged_nodes).toHaveLength(1);
    expect(report.flagged_nodes[0]).toMatchObject({ id: flaggedId, correct: true });
    expect(() => JSON.stringify(report)).not.toThrow();
  });
});
