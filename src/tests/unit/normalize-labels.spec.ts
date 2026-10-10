import { describe, it, expect } from "vitest";
import {
  LABEL_ATTRIBUTE_KEYS,
  alimSummary,
  bioSummary,
  labelsAttributes,
  qualiopiSummary,
  rgeSummary,
} from "@/lib/ingestion/normalize-labels";

const rgeRaw = {
  status: "ok",
  total: 22,
  lines: [
    { siret: "55208131766522", code: "C001D117", qualification: "Offre globale", domain: "Rénovation globale", body: "certibat", from: "2025-02-08", to: "2029-02-07" },
    { siret: "55208131765219", code: "C001D117", qualification: "Offre globale", domain: "Rénovation globale", body: "certibat", from: "2025-02-08", to: "2028-01-01" },
    { siret: "55208131766522", code: "CP032", qualification: "Audit énergétique", domain: "Etudes énergétiques", body: "afnor", from: "2023-10-12", to: "2027-10-12" },
  ],
};

describe("rgeSummary", () => {
  it("compte qualifications et établissements DISTINCTS, organismes et dernière échéance", () => {
    expect(rgeSummary(rgeRaw)).toBe(
      "2 qualifications sur 2 établissements — domaines : Rénovation globale, Etudes énergétiques — organismes : afnor, certibat — dernière échéance : 2029-02-07 (3 lignes analysées sur 22)",
    );
  });
  it("singulier et sans mention d'échantillon quand tout est analysé", () => {
    const s = rgeSummary({
      status: "ok",
      total: 1,
      lines: [{ siret: "1", code: "A", qualification: "Q", domain: "D", body: "qualibat", from: null, to: "2027-01-01" }],
    });
    expect(s).toBe(
      "1 qualification sur 1 établissement — domaines : D — organisme : qualibat — dernière échéance : 2027-01-01",
    );
  });
});

describe("bioSummary", () => {
  it("restitue le total, les certificateurs, les états et l'engagement le plus ancien", () => {
    const s = bioSummary({
      status: "ok",
      total: 862,
      operators: [
        { siret: "a", categories: [], certificates: [{ body: "Bureau Veritas", state: "ENGAGEE", engagedOn: "2009-02-05", suspendedOn: null, stoppedOn: null }] },
        { siret: "b", categories: [], certificates: [{ body: "Ecocert", state: "ENGAGEE", engagedOn: "2012-06-01", suspendedOn: null, stoppedOn: null }, { body: "Ecocert", state: "SUSPENDUE", engagedOn: null, suspendedOn: "2025-01-01", stoppedOn: null }] },
      ],
    });
    expect(s).toContain("862 établissements enregistrés");
    expect(s).toContain("certificateurs : Bureau Veritas, Ecocert");
    expect(s).toContain("états (sur 2 analysés) : engagée ×2, suspendue ×1");
    expect(s).toContain("plus ancien engagement : 2009-02-05");
    // Pas de mention d'échantillon quand tout est analysé.
    const all = bioSummary({
      status: "ok",
      total: 1,
      operators: [{ siret: "a", categories: [], certificates: [{ body: "Ecocert", state: "ARRETEE", engagedOn: null, suspendedOn: null, stoppedOn: "2024-01-01" }] }],
    });
    expect(all).toBe("1 établissement enregistré — certificateur : Ecocert — états : arrêtée ×1");
  });
});

describe("alimSummary", () => {
  it("ordonne du plus favorable au moins favorable et donne le dernier contrôle", () => {
    const s = alimSummary({
      status: "ok",
      total: 155,
      levels: [
        { level: "A améliorer", count: 1, latest: "2026-03-02" },
        { level: "Satisfaisant", count: 92, latest: "2026-10-07" },
        { level: "Très satisfaisant", count: 62, latest: "2026-09-01" },
      ],
    });
    expect(s).toBe(
      "155 contrôles publiés : Très satisfaisant 62 · Satisfaisant 92 · A améliorer 1 — dernier contrôle : 2026-10-07",
    );
  });
  it("aucun attribut sans contrôle", () => {
    expect(alimSummary({ status: "ok", total: 0, levels: [] })).toBeNull();
  });
});

describe("qualiopiSummary", () => {
  it("certifié : NDA + catégories", () => {
    expect(
      qualiopiSummary({
        status: "ok",
        total: 1,
        organisations: [{ nda: "11755589375", name: "EDF SA", siret: "x", categories: ["actions de formation"] }],
      }),
    ).toBe("déclaration d'activité n° 11755589375 — certification Qualiopi : actions de formation");
  });
  it("déclaré sans certification : formulé sans jugement", () => {
    const s = qualiopiSummary({
      status: "ok",
      total: 1,
      organisations: [{ nda: "1", name: "X", siret: null, categories: [] }],
    });
    expect(s).toContain("aucune catégorie de certification renseignée");
    expect(s).not.toMatch(/non conforme|manquement|défaut/i);
  });
});

describe("labelsAttributes", () => {
  it("ne produit que les clés des sources exploitables", () => {
    const a = labelsAttributes({ rge: rgeRaw, bio: null, alim: undefined, qualiopi: { status: "indisponible" } });
    expect(Object.keys(a)).toEqual([LABEL_ATTRIBUTE_KEYS.rge]);
  });

  it("n'invente rien : absence ou panne → aucun attribut, sans lever", () => {
    for (const bad of [null, undefined, {}, "x", 3, { status: "indisponible" }, { status: "ok" }]) {
      expect(labelsAttributes({ rge: bad, bio: bad, alim: bad, qualiopi: bad })).toEqual({});
    }
  });

  it("n'exprime aucun jugement ni accusation", () => {
    const text = Object.values(
      labelsAttributes({
        rge: rgeRaw,
        alim: { status: "ok", total: 1, levels: [{ level: "A améliorer", count: 1, latest: "2026-03-02" }] },
      }),
    ).join(" ");
    expect(text).not.toMatch(/fraude|sanction|infraction|non conforme/i);
  });
});
