import { describe, it, expect } from "vitest";
import type { FinancialEvent, Scenario } from "@/lib/learning/schema";
import { ASTER_SCENARIO } from "@/lib/learning/scenarios/aster";
import { NOVA_SCENARIO } from "@/lib/learning/scenarios/nova";
import { CONTROLE_ACTIFS, CRYPTO_FLUX, LEARNING_PATHS } from "@/lib/learning/paths";
import { LEARNING_SOURCES, nextReviewDate, pathReferences, reviewCadence, sourceUses } from "@/lib/learning/sources";
import {
  claimById,
  knownClaimsOf,
  notebookMarkdown,
  ownershipAt,
  ownershipHistory,
  stateAt,
  type ScenarioState,
} from "@/lib/learning/projections";

/**
 * Critères d'acceptation du cadrage (§12.3), vérifiés sur les deux
 * démonstrateurs : temporalité, flux, raisonnement, sources, parcours, export.
 */
const SCENARIOS = [
  ["Aster", ASTER_SCENARIO],
  ["Nova", NOVA_SCENARIO],
] as const;

/** Tous les états jouables : chaque étape, puis chaque branche. */
function allStates(s: Scenario): { label: string; state: ScenarioState }[] {
  const last = s.steps.length - 1;
  return [
    ...s.steps.map((step, i) => ({ label: step.marker, state: stateAt(s, i) })),
    ...s.branches.map((b) => ({ label: b.id, state: stateAt(s, last, b.id) })),
  ];
}

const ZERO = BigInt(0);

/** Montant décimal exact en unités de 10⁻⁸, sans passer par un flottant. */
function units(value: string): bigint {
  const [int, dec = ""] = value.split(".");
  return BigInt(int + dec.padEnd(8, "0").slice(0, 8));
}

describe("temporalité (§12.3)", () => {
  it("la propriété est la même dans la vue capital et dans la chronologie comparée", () => {
    const S = ASTER_SCENARIO;
    const last = S.steps.length - 1;
    const history = ownershipHistory(S, last);
    for (const column of history) {
      const i = S.steps.findIndex((s) => s.marker === column.marker);
      const own = ownershipAt(S, stateAt(S, i));
      expect(column.holders.map((h) => [h.actor.id, h.capitalPct])).toEqual(own.holders.map((h) => [h.actor.id, h.capitalPct]));
    }
  });

  it("à chaque date, le capital détenu totalise au plus 100 % et ne compte que les relations valides", () => {
    const S = ASTER_SCENARIO;
    for (const { label, state } of allStates(S)) {
      const own = ownershipAt(S, state);
      const fromGraph = state.relations
        .filter((r) => r.kind === "detention" && r.target === S.subjectId)
        .reduce((sum, r) => sum + Number(r.capitalPct ?? 0), 0);
      expect(own.totalCapitalPct, label).toBeCloseTo(fromGraph, 6);
      expect(own.totalCapitalPct, label).toBeLessThanOrEqual(100);
    }
  });
});

describe("flux (§12.3)", () => {
  const resources = new Set(NOVA_SCENARIO.resources.map((r) => r.id));

  it("chaque compte ou adresse ne fait pas sortir plus qu'il n'a reçu, unité par unité, frais compris", () => {
    for (const { label, state } of allStates(NOVA_SCENARIO)) {
      const balance = new Map<string, bigint>();
      const received = new Set<string>();
      for (const e of state.events) {
        for (const leg of e.legs) {
          if (leg.to && resources.has(leg.to)) {
            const k = `${leg.to}|${leg.amount.unit}`;
            balance.set(k, (balance.get(k) ?? ZERO) + units(leg.amount.value));
            received.add(k);
          }
          if (resources.has(leg.from)) {
            const k = `${leg.from}|${leg.amount.unit}`;
            balance.set(k, (balance.get(k) ?? ZERO) - units(leg.amount.value));
          }
        }
      }
      // Une origine sans entrée documentée (compte de départ, jeton de frais) n'est pas contrôlable.
      for (const k of received) expect(balance.get(k)! >= ZERO, `${label} › ${k}`).toBe(true);
    }
  });

  it("une opération n'additionne jamais deux unités : chaque jambe garde la sienne", () => {
    const unitSet = (e: FinancialEvent) => new Set(e.legs.map((l) => l.amount.unit));
    const echange = NOVA_SCENARIO.events.find((e) => e.id === "e-echange")!;
    expect(unitSet(echange)).toEqual(new Set(["S-EUR", "U-USD", "ALPHA"]));
    for (const e of NOVA_SCENARIO.events) {
      for (const l of e.legs) expect(l.amount.value, e.id).toMatch(/^\d+(\.\d+)?$/);
    }
  });

  it("aucune opération n'est affichée comme confirmée sans fait documenté connu", () => {
    for (const { label, state } of allStates(NOVA_SCENARIO)) {
      for (const e of state.events.filter((x) => x.status === "confirme")) {
        const known = knownClaimsOf(NOVA_SCENARIO, state, e);
        expect(known.some((c) => c.nature === "fait_documente"), `${label} › ${e.id}`).toBe(true);
      }
    }
  });

  it("quand la frontière demeure, aucun crédit bancaire n'est inféré après le dépôt", () => {
    const last = NOVA_SCENARIO.steps.length - 1;
    for (const b of NOVA_SCENARIO.branches.filter((x) => x.boundary)) {
      const state = stateAt(NOVA_SCENARIO, last, b.id);
      expect(state.boundary).toBe(b.boundary);
      expect(state.events.filter((e) => e.layer === "fiat").map((e) => e.id)).toEqual(["e-virement"]);
      expect(state.events.some((e) => e.legs.some((l) => l.from === "adresse-portey"))).toBe(false);
    }
  });
});

describe.each(SCENARIOS)("raisonnement et sources : %s (§12.3)", (_name, S) => {
  const last = S.steps.length - 1;

  it("une hypothèse ou une allégation ne change de statut que par un fait documenté de la branche", () => {
    for (const b of S.branches) {
      const state = stateAt(S, last, b.id);
      for (const r of b.resolves) {
        const by = claimById(S, r.byClaimId)!;
        expect(by.nature, `${b.id} › ${r.claimId}`).toBe("fait_documente");
        expect(state.claimIds.has(by.id), `${b.id} › ${by.id}`).toBe(true);
        expect(by.evidenceIds.some((e) => state.evidenceIds.has(e)), `${b.id} › ${by.id}`).toBe(true);
        // L'affirmation résolue garde sa nature : la résolution s'affiche à côté.
        expect(claimById(S, r.claimId)!.nature).not.toBe("fait_documente");
      }
    }
  });

  it("chaque preuve du débriefing renvoie à une pièce révélée", () => {
    for (const b of S.branches) {
      const state = stateAt(S, last, b.id);
      const preuve = b.levels.find((l) => l.level === "preuve");
      expect(preuve?.claimIds.length, b.id).toBeGreaterThan(0);
      for (const id of preuve!.claimIds) {
        const c = claimById(S, id)!;
        expect(c.nature, `${b.id} › ${id}`).toBe("fait_documente");
        expect(c.evidenceIds.some((e) => state.evidenceIds.has(e)), `${b.id} › ${id}`).toBe(true);
      }
      for (const l of b.levels) for (const id of l.claimIds) expect(state.claimIds.has(id), `${b.id} › ${l.level} › ${id}`).toBe(true);
    }
  });

  it("nationalité, établissement ou proximité dans le graphe ne sont jamais une bonne réponse", () => {
    const options = [...S.steps, ...S.branches].flatMap((x) => x.exercise?.options ?? []);
    const suspicious = options.filter((o) => /nationalit|hors de l'Union|établie hors|proximité/i.test(o.label));
    for (const o of suspicious) expect(o.verdict, o.label).toBe("faux");
  });

  it("le parcours va de la situation au débriefing et admet « informations insuffisantes »", () => {
    expect(S.steps.some((s) => s.exercise?.kind === "hypotheses")).toBe(true);
    expect(S.steps.some((s) => s.exercise?.kind === "verifications")).toBe(true);
    expect(S.branches).toHaveLength(2);
    for (const b of S.branches) {
      expect(new Set(b.levels.map((l) => l.level))).toEqual(new Set(["signal_faible", "facteur_risque", "faisceau", "preuve"]));
      expect(b.openQuestions.length, b.id).toBeGreaterThan(0);
    }
    const options = S.steps.flatMap((s) => s.exercise?.options ?? []);
    // Proposée et argumentée ; elle est juste quand les pièces ne permettent pas de conclure.
    const undecidable = options.filter((o) => /informations (sont )?insuffisantes/i.test(o.label));
    expect(undecidable.length).toBeGreaterThan(0);
    for (const o of undecidable) expect(o.feedback.length).toBeGreaterThan(20);
  });
});

describe.each([
  ["Aster", ASTER_SCENARIO, CONTROLE_ACTIFS],
  ["Nova", NOVA_SCENARIO, CRYPTO_FLUX],
] as const)("export de synthèse : %s (§12.3)", (_name, S, path) => {
  const last = S.steps.length - 1;

  it.each(S.branches.map((b) => [b.id, b] as const))("la branche %s s'exporte avec fiction, périmètre, sources et limites", (_id, b) => {
    const state = stateAt(S, last, b.id);
    const md = notebookMarkdown(S, state, {}, "2026-10-09", pathReferences(path));
    expect(md).toContain("**Cas fictif, formation.**");
    expect(md).toContain("- Exporté le : 09/10/2026");
    for (const h of ["## Périmètre", "## Lecture par niveau", "## Conclusion", "## Pièces examinées", "## Sources de référence", "## Limites"]) {
      expect(md, h).toContain(h);
    }
    expect(md).toContain("**Preuve** : ");
    if (b.boundary) expect(md).toContain(`Frontière de connaissance : ${b.boundary}`);

    // Aucune hypothèse ni allégation dans la section des faits.
    const faits = md.split("## Faits documentés")[1].split("\n## ")[0];
    for (const c of S.claims.filter((x) => x.nature !== "fait_documente" && state.claimIds.has(x.id))) {
      expect(faits, c.id).not.toContain(c.statement);
    }
    // Chaque source citée par les notions du parcours figure avec sa date de consultation.
    for (const s of pathReferences(path)) expect(md).toContain(`${s.publisher}, ${s.title}`);
  });
});

describe("fiches sources (§2.3)", () => {
  it("chaque source a un rythme de revue et une échéance postérieure à sa consultation", () => {
    for (const s of Object.values(LEARNING_SOURCES)) {
      expect(["mensuelle", "trimestrielle", "annuelle"]).toContain(reviewCadence(s));
      expect(nextReviewDate(s) > s.consultedOn, s.id).toBe(true);
    }
  });

  it("calcule l'échéance sans déborder sur le mois suivant", () => {
    const base = Object.values(LEARNING_SOURCES)[0];
    expect(nextReviewDate({ ...base, consultedOn: "2026-10-09", review: "trimestrielle" })).toBe("2027-01-09");
    expect(nextReviewDate({ ...base, consultedOn: "2026-01-31", review: "mensuelle" })).toBe("2026-02-28");
    expect(nextReviewDate({ ...base, consultedOn: "2026-10-09", review: "annuelle" })).toBe("2027-10-09");
  });

  it("les publications de risque sont en veille mensuelle", () => {
    for (const id of ["gafi-red-flags", "gafi-2026", "tracfin-2025", "dgsi-flash-ingerence"] as const) {
      expect(reviewCadence(LEARNING_SOURCES[id]), id).toBe("mensuelle");
    }
  });

  it("relie chaque source aux notions qui la citent", () => {
    const uses = sourceUses(LEARNING_PATHS);
    expect(uses.get("cmf-r561-1")?.map((u) => u.notionId)).toEqual(["beneficiaire-effectif"]);
    expect(uses.get("bitcoin-transactions")?.map((u) => u.pathSlug)).toEqual(["crypto-flux", "crypto-flux"]);
    const cited = new Set(LEARNING_PATHS.flatMap((p) => p.notions.flatMap((n) => n.sourceIds)));
    expect([...uses.keys()].sort()).toEqual([...cited].sort());
  });
});
