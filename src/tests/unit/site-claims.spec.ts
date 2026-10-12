import { describe, expect, it } from "vitest";
import { HOSTING_LAYERS, SUB_PROCESSORS } from "@/lib/domain/trust";
import { GUARDRAILS, PRIVACY_PRINCIPLES } from "@/lib/domain/privacy";
import {
  MIGRATION_STEPS,
  SOVEREIGNTY_COMPONENTS,
  SOVEREIGNTY_STATUS,
} from "@/lib/domain/sovereignty";

/**
 * Les pages publiques de confiance décrivent ce que le produit fait réellement :
 * mode réel sur données publiques, flux sortants (presse, registres étrangers),
 * import planifié par GitHub. Ces tests empêchent le retour d'affirmations périmées.
 */
describe("affirmations publiques de confiance", () => {
  const everything = JSON.stringify({
    HOSTING_LAYERS,
    SUB_PROCESSORS,
    GUARDRAILS,
    PRIVACY_PRINCIPLES,
    MIGRATION_STEPS,
    SOVEREIGNTY_COMPONENTS,
    SOVEREIGNTY_STATUS,
  });

  it("ne présente plus le produit comme une démonstration sans donnée réelle", () => {
    expect(everything).not.toMatch(/aucune donnée réelle traitée/i);
    expect(everything).not.toMatch(/Aucune donnée personnelle réelle ne transite/i);
    expect(everything).not.toMatch(/zéro appel API tiers/i);
    expect(SOVEREIGNTY_STATUS.badge).toMatch(/données publiques réelles/i);
    expect(MIGRATION_STEPS[0].trigger).toMatch(/données publiques réelles/i);
  });

  it("déclare les flux sortants réels : presse (États-Unis) et registres étrangers", () => {
    const press = HOSTING_LAYERS.find((l) => /GDELT/.test(l.provider));
    expect(press?.sovereign).toBe(false);
    expect(press?.dataScope).toMatch(/nom de l'entité/i);
    const foreign = HOSTING_LAYERS.find((l) => /GLEIF/.test(l.provider));
    expect(foreign?.dataScope).toMatch(/identifiant public/i);
    expect(SOVEREIGNTY_COMPONENTS.some((c) => /GDELT/.test(c.today))).toBe(true);
  });

  it("liste GitHub (imports planifiés) parmi les sous-traitants", () => {
    const gh = SUB_PROCESSORS.find((s) => s.name === "GitHub");
    expect(gh).toBeTruthy();
    expect(gh?.dpaUrl).toMatch(/^https:\/\//);
  });

  it("garde OpenSanctions et l'objectif PEP, marqués en cours de mise en service", () => {
    const pep = HOSTING_LAYERS.find((l) => /OpenSanctions/.test(l.provider));
    expect(pep?.dataScope).toMatch(/en cours de mise en service/i);
    expect(SOVEREIGNTY_COMPONENTS.some((c) => /OpenSanctions/.test(c.today) && /en cours/.test(c.today))).toBe(true);
  });

  it("dit où l'année de naissance peut apparaître, sans prétendre qu'elle n'est jamais affichée", () => {
    const min = PRIVACY_PRINCIPLES.find((p) => p.title === "Minimisation");
    expect(min?.body).toMatch(/année de naissance/i);
    expect(min?.body).toMatch(/réponses brutes des sources/i);
    expect(min?.body).toMatch(/rapprochement corroboré/i);
    expect(min?.body).not.toMatch(/jamais affichée/i);
  });

  it("n'annonce pas qu'aucune donnée personnelle ne transite chez l'hébergeur applicatif", () => {
    const vercel = SUB_PROCESSORS.find((s) => s.name === "Vercel");
    expect(vercel?.dataScope).not.toMatch(/pas de donnée personnelle/i);
    expect(vercel?.dataScope).toMatch(/dirigeants/i);
  });

  it("ne qualifie pas de souverains des registres hébergés hors de l'UE", () => {
    const foreign = SOVEREIGNTY_COMPONENTS.find((c) => /Registres étrangers/.test(c.component));
    expect(foreign?.sovereign).toBe(false);
    const layer = HOSTING_LAYERS.find((l) => /GLEIF/.test(l.provider));
    expect(layer?.sovereign).toBe(foreign?.sovereign);
  });
});
