import { describe, expect, it } from "vitest";
import { REG } from "@/lib/domain/regulatory-refs";
import {
  SOVEREIGNTY_FRAMEWORK,
  QUALIFIED_PROVIDERS,
  SOVEREIGNTY_COMPONENTS,
  MIGRATION_STEPS,
} from "@/lib/domain/sovereignty";
import { RESOURCE_GROUPS } from "@/lib/domain/resources";
import {
  LEGAL_BASES,
  PRIVACY_PRINCIPLES,
  WHAT_WE_DONT_CONCLUDE,
  GUARDRAILS,
  PRIVACY_REFS,
} from "@/lib/domain/privacy";
import {
  HOSTING_LAYERS,
  SUB_PROCESSORS,
  CERTIFICATIONS,
} from "@/lib/domain/trust";
import { ALGORITHM_EXPLAINERS } from "@/lib/domain/algorithm-explainers";

const ACCUSATORY = /fraude|coupable|criminel/i;

describe("références réglementaires", () => {
  it("chaque référence est datée, catégorisée et liée à un texte officiel", () => {
    const refs = Object.values(REG);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.label.length).toBeGreaterThan(0);
      expect(ref.url).toMatch(/^https:\/\//);
      expect(ref.date.length).toBeGreaterThan(0);
      expect(ref.category.length).toBeGreaterThan(0);
    }
  });
});

describe("page Ressources", () => {
  it("regroupe des ancrages datés et liés", () => {
    expect(RESOURCE_GROUPS.length).toBeGreaterThan(0);
    for (const group of RESOURCE_GROUPS) {
      expect(group.refs.length).toBeGreaterThan(0);
      for (const ref of group.refs) {
        expect(ref.url).toMatch(/^https:\/\//);
        expect(ref.date.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("page Souveraineté", () => {
  it("expose cadre, fournisseurs, composants et jalons", () => {
    expect(SOVEREIGNTY_FRAMEWORK.length).toBeGreaterThan(0);
    for (const ref of SOVEREIGNTY_FRAMEWORK)
      expect(ref.url).toMatch(/^https:\/\//);
    expect(QUALIFIED_PROVIDERS.length).toBeGreaterThan(0);
    expect(SOVEREIGNTY_COMPONENTS.length).toBeGreaterThan(0);
    expect(MIGRATION_STEPS.length).toBeGreaterThan(0);
    // Au moins un composant déjà souverain et un à migrer (récit honnête).
    expect(SOVEREIGNTY_COMPONENTS.some((c) => c.sovereign)).toBe(true);
    expect(SOVEREIGNTY_COMPONENTS.some((c) => !c.sovereign)).toBe(true);
  });
});

describe("page Confidentialité", () => {
  it("documente base légale, principes, garde-fous et périmètre", () => {
    expect(LEGAL_BASES.length).toBeGreaterThan(0);
    expect(PRIVACY_PRINCIPLES.length).toBeGreaterThan(0);
    expect(WHAT_WE_DONT_CONCLUDE.length).toBeGreaterThan(0);
    expect(GUARDRAILS.length).toBeGreaterThan(0);
    for (const ref of PRIVACY_REFS) expect(ref.url).toMatch(/^https:\/\//);
    // Rétention 5 ans (exigence AMLR) présente.
    expect(JSON.stringify(PRIVACY_PRINCIPLES)).toMatch(/5 ans/);
  });
});

describe("page Sécurité (trust center)", () => {
  it("liste hébergement, sous-traitants (DPA) et certifications datées", () => {
    expect(HOSTING_LAYERS.length).toBeGreaterThan(0);
    expect(SUB_PROCESSORS.length).toBeGreaterThan(0);
    for (const s of SUB_PROCESSORS) expect(s.dpaUrl).toMatch(/^https:\/\//);
    expect(CERTIFICATIONS.length).toBeGreaterThan(0);
    // Tout objectif porte une échéance (aucune certif revendiquée sans date).
    for (const c of CERTIFICATIONS) {
      if (c.status === "objectif") {
        expect(c.target && c.target.length > 0).toBe(true);
      }
    }
  });
});

describe("explainers d'algorithmes", () => {
  it("chaque algorithme expose ce qu'il prouve, sa limite et sa fonction source", () => {
    const entries = Object.values(ALGORITHM_EXPLAINERS);
    expect(entries.length).toBe(5);
    for (const e of entries) {
      expect(e.proves.length).toBeGreaterThan(0);
      expect(e.limit.length).toBeGreaterThan(0);
      expect(e.fn).toMatch(/src\/lib\/graph/);
    }
  });
});

describe("garde-fou anti-accusatoire", () => {
  it("aucun registre public n'emploie de vocabulaire accusatoire", () => {
    const blobs: unknown[] = [
      REG,
      SOVEREIGNTY_FRAMEWORK,
      QUALIFIED_PROVIDERS,
      SOVEREIGNTY_COMPONENTS,
      MIGRATION_STEPS,
      RESOURCE_GROUPS,
      LEGAL_BASES,
      PRIVACY_PRINCIPLES,
      WHAT_WE_DONT_CONCLUDE,
      GUARDRAILS,
      HOSTING_LAYERS,
      SUB_PROCESSORS,
      CERTIFICATIONS,
      ALGORITHM_EXPLAINERS,
    ];
    for (const blob of blobs) {
      expect(JSON.stringify(blob)).not.toMatch(ACCUSATORY);
    }
  });
});
