import { describe, it, expect } from "vitest";
import {
  REGULATORY_ATTRIBUTE_KEYS,
  annuaireSummary,
  icpeSummary,
  regulatoryAttributes,
} from "@/lib/ingestion/normalize-regulatory";

const site = (over: Record<string, unknown> = {}) => ({
  siret: "30271596600537",
  name: "SITE",
  commune: "ROUEN",
  regime: "Autorisation",
  seveso: "Non Seveso",
  ied: false,
  nationalPriority: false,
  status: "En exploitation avec titre",
  inspections: 0,
  lastInspection: null,
  ...over,
});

describe("icpeSummary", () => {
  it("régimes, Seveso, IED, état, dernière inspection et couverture partielle dite", () => {
    const s = icpeSummary({
      status: "ok",
      queried: 1,
      openTotal: 198,
      sites: [
        site({ regime: "Autorisation", seveso: "Seveso seuil bas", ied: true, lastInspection: "2026-09-22" }),
        site({ regime: "Autorisation", lastInspection: "2025-01-01" }),
        site({ regime: "Enregistrement", status: "En fin d'exploitation" }),
      ],
    });
    expect(s).toBe(
      "3 installations classées sur 1 établissement interrogé — régimes : Autorisation ×2, Enregistrement ×1 — état : en exploitation avec titre ×2, en fin d'exploitation ×1 — Seveso seuil bas ×1 — directive IED ×1 — dernière inspection : 2026-09-22 — couverture partielle : 1 établissement sur 198 ouverts (l'API Géorisques ne se rapproche que par SIRET)",
    );
  });

  it("couverture complète : aucune mention de couverture partielle", () => {
    const s = icpeSummary({ status: "ok", queried: 3, openTotal: 3, sites: [site()] });
    expect(s).toContain("1 installation classée sur 3 établissements interrogés");
    expect(s).not.toMatch(/couverture partielle/);
  });

  it("« Non ICPE » n'est pas une installation classée ; rien trouvé → aucun attribut", () => {
    expect(icpeSummary({ status: "ok", queried: 1, openTotal: 1, sites: [site({ regime: "Non ICPE" })] })).toBeNull();
    expect(icpeSummary({ status: "ok", queried: 1, openTotal: null, sites: [] })).toBeNull();
    expect(icpeSummary({ status: "indisponible", queried: 1, sites: [site()] })).toBeNull();
  });

  it("aucun jugement : ni sanction ni infraction", () => {
    const s = icpeSummary({ status: "ok", queried: 1, openTotal: 1, sites: [site({ seveso: "Seveso seuil haut" })] });
    expect(s).not.toMatch(/fraude|sanction|infraction|manquement|non conforme/i);
  });
});

describe("annuaireSummary / regulatoryAttributes", () => {
  it("total, types et fiche officielle", () => {
    const s = annuaireSummary({
      status: "ok",
      total: 19,
      services: [
        { name: "Mairie 6e", type: "mairie", url: "https://x/fiche" },
        { name: "Mairie 10e", type: "mairie", url: null },
        { name: "Hôtel de ville", type: "ad", url: null },
      ],
    });
    expect(s).toBe("19 services référencés — types : mairie ×2, ad ×1 — fiche : https://x/fiche");
  });

  it("n'invente rien : absence ou panne → rien, sans lever", () => {
    for (const bad of [null, undefined, {}, "x", 3, { status: "indisponible" }, { status: "ok" }]) {
      expect(regulatoryAttributes({ icpe: bad, annuaire: bad })).toEqual({});
    }
  });

  it("clés d'attribut stables", () => {
    const a = regulatoryAttributes({
      icpe: { status: "ok", queried: 1, openTotal: 1, sites: [site()] },
      annuaire: { status: "ok", total: 1, services: [{ name: "X", type: "mairie", url: null }] },
    });
    expect(Object.keys(a).sort()).toEqual(Object.values(REGULATORY_ATTRIBUTE_KEYS).sort());
  });
});
