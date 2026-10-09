import { describe, it, expect } from "vitest";
import { NOVA_SCENARIO as S } from "@/lib/learning/scenarios/nova";
import {
  diffStates,
  feeLegs,
  movementLegs,
  notebookMarkdown,
  stateAt,
  timelineAt,
  unitsOf,
} from "@/lib/learning/projections";

const idx = (marker: string) => S.steps.findIndex((s) => s.marker === marker);
const last = S.steps.length - 1;

describe("scénario Nova : données", () => {
  it("se charge, est fictif, et n'utilise que des adresses fictives", () => {
    expect(S.fiction).toBe(true);
    for (const r of S.resources.filter((x) => x.kind === "adresse")) expect(r.identifier).toMatch(/^0xFICTIF/);
    expect(S.actors.length + S.resources.length).toBeLessThanOrEqual(12);
  });

  it("chaque jambe garde son unité : aucune opération n'additionne des unités différentes", () => {
    const echange = S.events.find((e) => e.id === "e-echange")!;
    expect(unitsOf(echange).sort()).toEqual(["ALPHA", "S-EUR", "U-USD"]);
    // Côté S-EUR, entrée et frais du contrat redonnent exactement le montant reçu.
    const seur = echange.legs.filter((l) => l.amount.unit === "S-EUR" && l.from === "adresse-dest");
    const centimes = seur.reduce((t, l) => t + Math.round(Number(l.amount.value) * 100), 0);
    expect(centimes).toBe(4985000);
    expect(feeLegs(echange).map((l) => l.amount.unit).sort()).toEqual(["ALPHA", "S-EUR"]);
  });

  it("une réponse « informations insuffisantes » est juste au moins une fois", () => {
    const juste = S.steps
      .flatMap((s) => s.exercise?.options ?? [])
      .filter((o) => o.verdict === "juste" && /Informations insuffisantes/.test(o.label));
    expect(juste.length).toBeGreaterThan(0);
  });
});

describe("scénario Nova : parcours et connaissance", () => {
  it("à la situation initiale, aucun mouvement n'est connu", () => {
    const s0 = stateAt(S, idx("Situation"));
    expect(s0.events).toEqual([]);
    expect(s0.objectIds).toEqual(expect.arrayContaining(["nova", "lumen", "adresse-contrat"]));
    expect(s0.objectIds).not.toContain("adresse-dest");
  });

  it("le parcours révèle cinq opérations dans l'ordre, et s'arrête à une frontière", () => {
    const s = stateAt(S, idx("Parcours"));
    expect(s.events.map((e) => e.id)).toEqual(["e-virement", "e-achat", "e-envoi", "e-echange", "e-depot"]);
    expect(s.boundary).toMatch(/aucune pièce ne documente/);
    // L'achat interne n'ajoute pas d'arête de mouvement au graphe, mais les autres oui.
    expect(s.objectIds).toEqual(expect.arrayContaining(["adresse-dest", "contrat-echange", "adresse-portey"]));
    expect(diffStates(stateAt(S, idx("Situation")), s).addedEventIds).toHaveLength(5);
  });

  it("l'attribution à Kappa reste une allégation tant qu'aucune pièce ne la documente", () => {
    const signal = stateAt(S, idx("Signal"));
    expect(signal.claimIds.has("c-discordance")).toBe(true);
    expect(signal.relations.map((r) => r.id)).toContain("kappa-adresse");
    expect(signal.claimIds.has("c-attestation-kappa")).toBe(false);
    // La discordance combine trois pièces : elle n'est pas connue avant l'instruction.
    expect(stateAt(S, idx("Parcours")).claimIds.has("c-discordance")).toBe(false);
  });

  it("branche A : la sortie bancaire est documentée ; branche B : elle reste inconnue", () => {
    const a = stateAt(S, last, "branche-a");
    const b = stateAt(S, last, "branche-b");
    expect(a.events.map((e) => e.id)).toContain("e-reversement");
    expect(a.boundary).toBeUndefined();
    expect(b.events.map((e) => e.id)).not.toContain("e-reversement");
    expect(b.boundary).toMatch(/cadre légal/);
    expect(b.resolutions.get("c-instruction-dit")?.outcome).toBe("infirmee");
    expect(a.resolutions.get("c-instruction-dit")?.outcome).toBe("confirmee");
  });

  it("chaque opération visible a au moins un observateur, et l'interne échappe à l'analyste", () => {
    const s = stateAt(S, last, "branche-a");
    for (const e of s.events) expect(e.visibleTo.length).toBeGreaterThan(0);
    const achat = s.events.find((e) => e.id === "e-achat")!;
    expect(achat.visibleTo).not.toContain("analyste");
    expect(movementLegs(achat).length).toBe(2);
  });

  it("la chronologie sépare date de l'opération et étape de connaissance", () => {
    const t = timelineAt(S, stateAt(S, idx("Signal")));
    const envoi = t.find((e) => e.type === "event" && e.event.id === "e-envoi");
    expect(envoi && envoi.type === "event" ? envoi.knownAt : null).toBe("Parcours");
    expect(t.map((e) => e.date)).toEqual([...t.map((e) => e.date)].sort());
  });

  it("l'export porte la mention fictive et la frontière n'est jamais exportée comme un fait", () => {
    const md = notebookMarkdown(S, stateAt(S, last, "branche-b"), { "ex-parcours": ["c"] }, "2026-10-09");
    expect(md).toContain("Cas fictif, formation.");
    expect(md).toContain("## Informations manquantes");
    const faits = md.split("## Faits documentés")[1].split("\n## ")[0];
    expect(faits).not.toContain("Aucune pièce n'attribue");
    expect(md.split("## Informations manquantes")[1]).toContain("Aucune pièce n'attribue");
  });
});
