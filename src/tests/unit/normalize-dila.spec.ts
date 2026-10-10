import { describe, it, expect } from "vitest";
import {
  dilaAttributes,
  normalizeBalo,
  normalizeBoamp,
  normalizeDca,
  normalizeJoafe,
} from "@/lib/ingestion/normalize-dila";
import { inferEventSource } from "@/lib/data/case-quality";

const COMPANY = "co:552081317";

describe("normalizeBalo", () => {
  const raw = {
    status: "ok",
    total: 101,
    items: [
      { id: "A1", date: "2026-08-03", category: "Publications periodiques — Comptes annuels", numero: "2603311", names: ["X"], otherSirens: [] },
      { id: "A2", date: "2026-07-01", category: "Avis de convocation", numero: null, names: ["X", "Y"], otherSirens: ["811475383", "9"] },
    ],
  };

  it("crée des événements CONFIRMÉS de type annonce_financiere, datés et attribués au BALO", () => {
    const evs = normalizeBalo(raw, COMPANY);
    expect(evs).toHaveLength(2);
    expect(evs[0]).toMatchObject({
      id: "ev:balo:A1",
      entityId: COMPANY,
      kind: "annonce_financiere",
      evidenceLevel: "confirmed",
      occurredOn: "2026-08-03",
    });
    expect(evs[0].title).toContain("affaire n° 2603311");
    expect(evs[1].title).toContain("publiée avec 2 autre(s) société(s)");
    expect(inferEventSource(evs[0])).toBe("balo");
  });

  it("n'emprunte aucun kind du BODACC (aucun effet sur les facteurs atténuants)", () => {
    const kinds = normalizeBalo(raw, COMPANY).map((e) => e.kind);
    expect(kinds.some((k) => ["procedure_collective", "radiation"].includes(k))).toBe(false);
  });
});

describe("normalizeBoamp", () => {
  it("dit « mentionnant l'entreprise » et reprend les titulaires publiés, sans désigner de titulaire", () => {
    const evs = normalizeBoamp(
      {
        status: "ok",
        total: 25,
        items: [
          { id: "26-1", date: "2026-09-24", buyer: "Commune d'Oloron", titulaires: ["A", "B", "C", "D", "E", "F"], object: null, url: null },
        ],
      },
      COMPANY,
    );
    expect(evs[0].kind).toBe("marche_public_resultat");
    expect(evs[0].title).toContain("mentionnant l'entreprise");
    expect(evs[0].title).toContain("acheteur : Commune d'Oloron");
    expect(evs[0].title).toContain("(+2)");
    expect(evs[0].title).not.toMatch(/titulaire de/i);
    expect(inferEventSource(evs[0])).toBe("boamp");
  });
});

describe("normalizeDca / normalizeJoafe", () => {
  const dcaRaw = {
    status: "ok",
    total: 7,
    rna: "W1",
    items: [{ id: "d1", date: "2026-03-02", closedOn: "2025-12-31", type: null, state: null, category: null, title: null, titleNew: null, titleOld: null, rna: "W1" }],
  };
  const joafeRaw = {
    status: "ok",
    total: 3,
    rna: "W1",
    items: [
      { id: "j1", date: "2026-10-06", closedOn: null, type: "Modification", state: "Rectificatif", category: "Associations loi du 1er juillet 1901", title: "NOUVEAU", titleNew: "NOUVEAU", titleOld: "ANCIEN", rna: "W1" },
      { id: "j2", date: "2026-01-02", closedOn: null, type: "Création", state: "Initial", category: null, title: "X", titleNew: null, titleOld: null, rna: "W1" },
    ],
  };

  it("DCA : événement dépôt de comptes avec exercice clos", () => {
    const [ev] = normalizeDca(dcaRaw, COMPANY);
    expect(ev).toMatchObject({ id: "ev:dca:d1", kind: "depot_comptes_association", occurredOn: "2026-03-02" });
    expect(ev.title).toContain("exercice clos le 2025-12-31");
    expect(inferEventSource(ev)).toBe("dca");
  });

  it("JOAFE : type, état (sauf « initial ») et changement de nom", () => {
    const evs = normalizeJoafe(joafeRaw, COMPANY);
    expect(evs[0].title).toBe(
      "Modification (rectificatif) — Associations loi du 1er juillet 1901 : « ANCIEN » → « NOUVEAU »",
    );
    expect(evs[1].title).toBe("Création");
    expect(evs.every((e) => e.kind === "annonce_association")).toBe(true);
    expect(inferEventSource(evs[0])).toBe("joafe");
  });

  it("n'invente rien : absence ou panne → rien, sans lever", () => {
    for (const bad of [null, undefined, {}, "x", { status: "indisponible" }]) {
      expect(normalizeBalo(bad, COMPANY)).toEqual([]);
      expect(normalizeBoamp(bad, COMPANY)).toEqual([]);
      expect(normalizeDca(bad, COMPANY)).toEqual([]);
      expect(normalizeJoafe(bad, COMPANY)).toEqual([]);
      expect(dilaAttributes({ balo: bad, boamp: bad, dca: bad, joafe: bad })).toEqual({});
    }
  });
});

describe("dilaAttributes", () => {
  it("expose les volumes totaux non nuls", () => {
    const a = dilaAttributes({
      balo: { status: "ok", total: 101, items: [] },
      boamp: { status: "ok", total: 0, items: [] },
      dca: { status: "ok", total: 7, rna: null, items: [] },
    });
    expect(a).toEqual({
      "Annonces BALO (total)": "101",
      "Dépôts de comptes d'association (total)": "7",
    });
  });
});
