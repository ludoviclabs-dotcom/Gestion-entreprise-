import { describe, it, expect } from "vitest";
import { LearningPath, Scenario, SourceRecord } from "@/lib/learning/schema";
import { LEARNING_PATHS } from "@/lib/learning/paths";
import { LEARNING_SOURCES, getSource } from "@/lib/learning/sources";

describe("contenus des parcours", () => {
  it.each(LEARNING_PATHS.map((p) => [p.slug, p] as const))("le parcours %s respecte le schéma", (_slug, path) => {
    expect(() => LearningPath.parse(path)).not.toThrow();
  });

  it("chaque notion cite des sources qui existent dans le registre", () => {
    for (const path of LEARNING_PATHS) {
      for (const notion of path.notions) {
        for (const id of notion.sourceIds) {
          expect(getSource(id), `${path.slug} › ${notion.id} › ${id}`).toBeDefined();
        }
      }
    }
  });

  it("chaque source a une date de consultation et dit ce qu'elle permet d'affirmer", () => {
    for (const source of Object.values(LEARNING_SOURCES)) {
      expect(() => SourceRecord.parse(source)).not.toThrow();
    }
  });
});

const minimal = {
  id: "s",
  version: "0.1.0",
  title: "Cas",
  fiction: true,
  summary: "Résumé",
  actors: [
    { id: "a", kind: "entreprise", name: "A", origin: "fictive" },
    { id: "b", kind: "investisseur", name: "B", origin: "fictive" },
  ],
  relations: [{ id: "r1", kind: "detention", source: "b", target: "a", capitalPct: "45", votingPct: "45" }],
  evidence: [{ id: "p1", title: "Pacte", origin: "fictive", excerpt: "Article 3 : …" }],
  claims: [{ id: "c1", statement: "B détient 45 %", nature: "fait_documente", verification: "declare", evidenceIds: ["p1"] }],
  subjectId: "a",
  steps: [{ id: "t0", marker: "T0", title: "T0", question: "Qui détient A ?", reveals: ["p1"], explanation: "…" }],
};

describe("schéma de scénario", () => {
  it("accepte un scénario cohérent", () => {
    expect(Scenario.safeParse(minimal).success).toBe(true);
  });

  it("refuse un scénario qui n'est pas marqué fictif", () => {
    expect(Scenario.safeParse({ ...minimal, fiction: false }).success).toBe(false);
  });

  it("refuse une relation vers un objet inconnu", () => {
    const bad = { ...minimal, relations: [{ ...minimal.relations[0], target: "zz" }] };
    expect(Scenario.safeParse(bad).success).toBe(false);
  });

  it("refuse un fait documenté sans pièce", () => {
    const bad = { ...minimal, claims: [{ ...minimal.claims[0], evidenceIds: [] }] };
    expect(Scenario.safeParse(bad).success).toBe(false);
  });

  it("refuse un montant en flottant non sérialisé", () => {
    const bad = {
      ...minimal,
      events: [
        {
          id: "e1",
          label: "Achat",
          occurredOn: "2026-01-01",
          status: "confirme",
          legs: [{ from: "a", to: "b", amount: { value: 1000.5, unit: "EUR" }, role: "envoi" }],
        },
      ],
    };
    expect(Scenario.safeParse(bad).success).toBe(false);
  });

  it("refuse un pourcentage hors bornes", () => {
    const bad = { ...minimal, relations: [{ ...minimal.relations[0], capitalPct: "120" }] };
    expect(Scenario.safeParse(bad).success).toBe(false);
  });
});
