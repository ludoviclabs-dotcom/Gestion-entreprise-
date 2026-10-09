import { describe, it, expect } from "vitest";
import { ASTER_SCENARIO as S } from "@/lib/learning/scenarios/aster";
import {
  answeredExercises,
  assetsAt,
  canSubmit,
  dependenciesAt,
  diffStates,
  gradeExercise,
  notebookMarkdown,
  ownershipAt,
  ownershipHistory,
  stateAt,
  timelineAt,
} from "@/lib/learning/projections";

const idx = (marker: string) => S.steps.findIndex((s) => s.marker === marker);
const holders = (marker: string) =>
  Object.fromEntries(ownershipAt(S, stateAt(S, idx(marker))).holders.map((h) => [h.actor.id, h]));

describe("scénario Aster : données", () => {
  it("se charge, est fictif et compte cinq étapes datées puis deux branches", () => {
    expect(S.fiction).toBe(true);
    expect(S.steps.filter((s) => s.asOf).map((s) => s.marker)).toEqual(["T0", "T1", "T2", "T3", "T4"]);
    expect(S.branches.map((b) => b.id)).toEqual(["branche-a", "branche-b"]);
  });

  it("chaque exercice propose une réponse juste et un retour par option", () => {
    const exercises = [...S.steps, ...S.branches].map((s) => s.exercise).filter((e) => e !== undefined);
    expect(exercises).toHaveLength(9);
    for (const e of exercises) {
      expect(e.options.some((o) => o.verdict === "juste")).toBe(true);
      for (const o of e.options) expect(o.feedback.length).toBeGreaterThan(10);
    }
  });

  it("aucune option juste n'accuse sur la base de la nationalité", () => {
    const juste = [...S.steps, ...S.branches]
      .flatMap((s) => s.exercise?.options ?? [])
      .filter((o) => o.verdict === "juste")
      .map((o) => o.label.toLowerCase());
    for (const label of juste) expect(label).not.toMatch(/nationalit|hors de l'union|hostile|espionn/);
  });

  it("le capital somme à 100 % à chaque date", () => {
    for (const m of ["T0", "T1", "T2", "T3", "T4"]) {
      const own = ownershipAt(S, stateAt(S, idx(m)));
      expect(own.totalCapitalPct).toBe(100);
      expect(own.totalVotingPct).toBe(100);
    }
  });
});

describe("scénario Aster : propriété et contrôle", () => {
  it("T0 : la fondatrice détient la majorité et est bénéficiaire effective", () => {
    const h = holders("T0");
    expect(h.fondatrice.control).toBe("majorite");
    expect(h.fondatrice.qualification).toBe("beneficiaire");
    expect(h["invest-init"].qualification).toBe("personne_morale");
    expect(h["invest-init"].missing.map((c) => c.id)).toContain("c-repartition-init");
    expect(h.helix).toBeUndefined();
  });

  it("T1 : Helix à 45 % est présumée contrôler (L. 233-3 II), la fondatrice reste au-dessus du seuil", () => {
    const h = holders("T1");
    expect(h.helix.capitalPct).toBe("45");
    expect(h.helix.control).toBe("presomption");
    expect(h.helix.qualification).toBe("personne_morale");
    expect(h.helix.missing.map((c) => c.id)).toContain("c-detenteurs-helix");
    expect(h.fondatrice.control).toBe("aucun");
    expect(h.fondatrice.qualification).toBe("beneficiaire");
    const own = ownershipAt(S, stateAt(S, idx("T1")));
    expect(own.otherControl.map((c) => c.relation.id)).toEqual(["ctl-pacte"]);
    expect(own.policy.id).toBe("FR_CMF_R561_1");
    expect(own.upcoming?.id).toBe("EU_AMLR_2024_1624");
  });

  it("T2 : Helix à 55 % détient la majorité", () => {
    const h = holders("T2");
    expect(h.helix.control).toBe("majorite");
    expect(h.fondatrice.capitalPct).toBe("31.5");
    expect(h.fondatrice.qualification).toBe("beneficiaire");
  });

  it("la chronologie comparée n'utilise que les étapes jouées", () => {
    expect(ownershipHistory(S, idx("T1")).map((c) => c.marker)).toEqual(["T0", "T1"]);
    const all = ownershipHistory(S, S.steps.length - 1);
    expect(all.map((c) => c.marker)).toEqual(["T0", "T1", "T2", "T3", "T4"]);
  });
});

describe("scénario Aster : relations visibles", () => {
  it("une relation n'apparaît qu'une fois sa pièce révélée et à sa date de validité", () => {
    const t0 = stateAt(S, idx("T0"));
    expect(t0.objectIds).not.toContain("helix");
    expect(t0.objectIds).not.toContain("vectorlab");
    const t1 = stateAt(S, idx("T1"));
    expect(t1.objectIds).toContain("helix");
    expect(t1.relations.map((r) => r.id)).not.toContain("own-fond-t0");
    expect(t1.relations.map((r) => r.id)).toContain("own-fond-t1");
  });

  it("T4 : la prestation est terminée mais l'accès reste ouvert", () => {
    const t4 = stateAt(S, idx("T4")).relations.map((r) => r.id);
    expect(t4).not.toContain("pre-vectorlab");
    expect(t4).toContain("acc-vectorlab");
    const d = diffStates(stateAt(S, idx("T3")), stateAt(S, idx("T4")));
    expect(d.endedRelationIds).toContain("pre-vectorlab");
    expect(d.newClaimIds).toEqual(expect.arrayContaining(["c-signalement", "c-avenant-absent"]));
  });

  it("T3 : la dépendance Meridian s'affiche avec ses entrées et sa période", () => {
    const deps = dependenciesAt(S, stateAt(S, idx("T3")));
    const meridian = deps.find((d) => d.relation.id === "dep-meridian");
    expect(meridian?.ratio?.pct).toBeCloseTo(58.06, 1);
    expect(meridian?.ratio?.period).toBe("Exercice 2025");
    expect(deps.find((d) => d.relation.id === "sur-orion")?.counterpartId).toBe("orion");
  });

  it("le brevet a un titulaire, une licence et une sûreté distincts", () => {
    const brevet = assetsAt(S, stateAt(S, idx("T3"))).find((a) => a.resource.id === "brevet");
    expect(brevet?.holderIds).toEqual(["aster"]);
    expect(brevet?.licences.map((r) => r.target)).toEqual(["meridian"]);
    expect(brevet?.suretes.map((r) => r.source)).toEqual(["orion"]);
  });

  it("les relations de branche ne s'affichent que dans leur branche", () => {
    const last = S.steps.length - 1;
    const a = stateAt(S, last, "branche-a").relations.map((r) => r.id);
    const b = stateAt(S, last, "branche-b").relations.map((r) => r.id);
    expect(a).toContain("pre-vectorlab-avenant");
    expect(a).not.toContain("acc-procede");
    expect(b).toContain("acc-procede");
    expect(b).not.toContain("pre-vectorlab-avenant");
    expect(stateAt(S, last, "branche-b").resolutions.get("c-hyp-acces-illicite")?.outcome).toBe("confirmee");
  });

  it("la chronologie trie pièces et repères", () => {
    const t = timelineAt(S, stateAt(S, idx("T2")));
    const dates = t.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
    expect(t.filter((e) => e.type === "marker").map((e) => (e.type === "marker" ? e.marker : ""))).toEqual(["T0", "T1", "T2"]);
  });
});

describe("exercices et carnet", () => {
  const hyp = S.steps.find((s) => s.id === "hypotheses")!.exercise!;
  const verif = S.steps.find((s) => s.id === "verifications")!.exercise!;

  it("respecte les bornes de sélection", () => {
    expect(canSubmit(hyp, ["h1"])).toBe(false);
    expect(canSubmit(hyp, ["h1", "h3"])).toBe(true);
    expect(canSubmit(verif, ["v1", "v2", "v3", "v4"])).toBe(false);
  });

  it("une accusation sans pièce rend la réponse partielle", () => {
    expect(gradeExercise(hyp, ["h1", "h4"])).toBe("juste");
    expect(gradeExercise(hyp, ["h1", "h5"])).toBe("partiel");
    expect(gradeExercise(hyp, ["h5", "h6"])).toBe("faux");
  });

  it("exporte un carnet marqué fictif avec réponses et conclusion", () => {
    const state = stateAt(S, S.steps.length - 1, "branche-b");
    const md = notebookMarkdown(S, state, { "ex-t1": ["c"], "ex-branche-b": ["a"] }, "2026-10-09");
    expect(md).toContain("Cas fictif, formation.");
    expect(md).toContain("État au : 16/06/2026");
    expect(md).toContain("## Informations manquantes");
    expect(md).toContain("**T1** (juste)");
    expect(md).toContain("## Conclusion");
    expect(md).toMatch(/infirmée/);
    expect(answeredExercises(S, { "ex-t1": ["c"] }).map((a) => a.marker)).toEqual(["T1"]);
  });
});
