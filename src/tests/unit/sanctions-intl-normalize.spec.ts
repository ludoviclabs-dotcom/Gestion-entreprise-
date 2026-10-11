import { describe, it, expect } from "vitest";
import {
  SANCTIONS_INTL_ATTRIBUTE,
  classifyMatch,
  isDistinctiveName,
  listNature,
  normalizeSanctionsIntl,
} from "@/lib/ingestion/normalize-sanctions-intl";
import type { SanctionMatch } from "@/lib/connectors/sanctions-intl";

const m = (over: Partial<SanctionMatch> = {}): SanctionMatch => ({
  queryKey: "subject", queryName: "Rosneft Oil Company", list: "us", listLabel: "États-Unis — liste consolidée (CSL)",
  sublist: "SDN — OFAC (Trésor)", nom: "Rosneft Oil Company", matchType: "exact", score: 1, kind: "entity",
  matchedName: over.nom ?? "Rosneft Oil Company",
  programs: ["RUSSIA-EO14024"], countries: ["RU"], listedOn: "2022-03-24", entryKey: "e-1", ...over,
});

describe("isDistinctiveName — noms génériques écartés", () => {
  it.each([
    ["ATLAS", false], ["ALLIANCE", false], ["PHOENIX", false], ["GLOBAL", false],
    ["AM GROUP", false], ["ALLIANCE INTERNATIONAL", false], ["BANQUE POPULAIRE", false],
    ["ROSNEFT OIL COMPANY", true], ["BANK SEPAH", true], ["VTB BANK", true],
    ["BANK MELLI IRAN", true], ["MAHAN AIR", true], ["SOCIETE GENERALE", false],
    ["ELECTRICITE DE FRANCE", true],
  ])("%s → %s", (name, expected) => {
    expect(isDistinctiveName(name)).toBe(expected);
  });
});

describe("classifyMatch — forte ou faible", () => {
  it("exacte, organisation, nom distinctif → forte", () => {
    expect(classifyMatch(m())).toBe("strong");
  });
  it("type non précisé par la liste → toujours faible", () => {
    expect(classifyMatch(m({ kind: "unknown" }))).toBe("weak");
  });
  it("nom interrogé générique → faible même si exact", () => {
    expect(classifyMatch(m({ queryName: "ATLAS", nom: "LLC Atlas" }))).toBe("weak");
  });
  it("approximatif : fort seulement à ≥ 0,96 sur une dénomination d'au moins 10 caractères", () => {
    expect(classifyMatch(m({ matchType: "approximatif", score: 0.97 }))).toBe("strong");
    expect(classifyMatch(m({ matchType: "approximatif", score: 0.94 }))).toBe("weak");
    expect(classifyMatch(m({ matchType: "approximatif", score: 0.97, queryName: "AMS BANK" }))).toBe("weak");
  });
});

describe("normalizeSanctionsIntl", () => {
  const lists = (state: "ok" | "stale" | "missing" = "ok") =>
    (["us", "uk", "un", "ch", "ca"] as const).map((key) => ({
      key, label: `Liste ${key}`, state, importedAt: "2026-10-11T04:50:00.000Z",
      checkedAt: "2026-10-11T04:50:00.000Z", entries: 10,
    }));
  const ids = { subject: "co:552032534", "lei:P": "co:lei:P" };

  it("nœud sanction + lien EST_VISE_PAR depuis la société interrogée", () => {
    const out = normalizeSanctionsIntl({ status: "ok", lists: lists(), matches: [m({ queryKey: "lei:P" })] }, { entityIds: ids });
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0]).toMatchObject({
      type: "sanction", label: "Correspondance « Rosneft Oil Company »", evidenceLevel: "declared",
      attributes: { Nature: "Sanctions", Programmes: "RUSSIA-EO14024", Pays: "RU", "Inscrit le": "2022-03-24" },
    });
    expect(out.edges).toEqual([expect.objectContaining({ type: "EST_VISE_PAR", source: "co:lei:P", target: out.entities[0].id })]);
  });

  it("jamais « confirmé » : l'approximatif reste « simulated »", () => {
    const out = normalizeSanctionsIntl(
      { status: "ok", lists: lists(), matches: [m({ matchType: "approximatif", score: 0.97 })] }, { entityIds: ids });
    expect(out.entities[0].evidenceLevel).toBe("simulated");
    expect(out.entities[0].attributes?.Type).toBe("Correspondance approximative");
  });

  it("une même entrée trouvée pour deux sociétés : un nœud, deux liens", () => {
    const out = normalizeSanctionsIntl(
      { status: "ok", lists: lists(), matches: [m(), m({ queryKey: "lei:P" })] }, { entityIds: ids });
    expect(out.entities).toHaveLength(1);
    expect(out.edges).toHaveLength(2);
  });

  it("liste de contrôle des exportations : nature distincte d'un gel d'avoirs", () => {
    expect(listNature("Entity List — BIS (Commerce)")).toMatch(/Contrôle des exportations/);
    expect(listNature("SDN — OFAC (Trésor)")).toBe("Sanctions");
    expect(listNature(null)).toBe("Sanctions");
  });

  it("clé de requête inconnue ou nom vide : ignorée, jamais d'exception", () => {
    const out = normalizeSanctionsIntl(
      { status: "ok", lists: lists(), matches: [m({ queryKey: "inconnue" }), m({ nom: "" })] }, { entityIds: ids });
    expect(out.entities).toEqual([]);
    expect(normalizeSanctionsIntl(null, { entityIds: ids })).toEqual({ entities: [], edges: [], attributes: {} });
  });

  it("l'attribut nomme les listes consultées, leurs dates et l'absence de correspondance", () => {
    const out = normalizeSanctionsIntl({ status: "ok", lists: lists(), matches: [] }, { entityIds: ids });
    const text = out.attributes[SANCTIONS_INTL_ATTRIBUTE];
    expect(text).toContain("Consultées : Liste us (vérifiée le 2026-10-11)");
    expect(text).toContain("Aucune correspondance nominative.");
  });

  it("aucune liste consultée : pas de « aucune correspondance » inventé", () => {
    const out = normalizeSanctionsIntl({ status: "non_importe", lists: lists("missing").map((l) => ({ ...l, checkedAt: null, importedAt: null })), matches: [] }, { entityIds: ids });
    const text = out.attributes[SANCTIONS_INTL_ATTRIBUTE] ?? "";
    expect(text).toContain("Non consultées ou non à jour");
    expect(text).not.toContain("Aucune correspondance nominative");
  });

  it("couverture tronquée : dite", () => {
    const out = normalizeSanctionsIntl({ status: "ok", lists: lists(), matches: [], truncated: true }, { entityIds: ids });
    expect(out.attributes[SANCTIONS_INTL_ATTRIBUTE]).toContain("Pré-sélection tronquée");
  });

  describe("nom rapproché (alias ou autre dénomination de la même entrée)", () => {
    const melli = {
      queryName: "BANK MELLI IRAN", nom: "MB BANK", matchedName: "BANK MELLI IRAN ZAO",
      matchType: "approximatif" as const, score: 0.97,
    };

    it("correspondance forte : le nom réellement rapproché est affiché, le nom principal reste le libellé", () => {
      const out = normalizeSanctionsIntl({ status: "ok", lists: lists(), matches: [m(melli)] }, { entityIds: ids });
      expect(out.entities[0].label).toBe("Correspondance « MB BANK »");
      expect(out.entities[0].attributes?.["Nom rapproché"]).toContain("BANK MELLI IRAN ZAO");
    });

    it("nom principal rapproché : aucun attribut superflu (casse, accents, formes juridiques ignorés)", () => {
      const same = normalizeSanctionsIntl(
        { status: "ok", lists: lists(), matches: [m({ nom: "Rosneft Oil Company", matchedName: "ROSNEFT OIL COMPANY" })] },
        { entityIds: ids },
      );
      expect(same.entities[0].attributes?.["Nom rapproché"]).toBeUndefined();
    });

    it("correspondance faible : l'alias est dit dans l'attribut", () => {
      const out = normalizeSanctionsIntl(
        { status: "ok", lists: lists(), matches: [m({ ...melli, kind: "unknown" })] },
        { entityIds: ids },
      );
      expect(out.entities).toHaveLength(0);
      expect(out.attributes[SANCTIONS_INTL_ATTRIBUTE]).toContain("« MB BANK » (rapproché de « BANK MELLI IRAN ZAO »)");
    });

    it("donnée antérieure sans nom rapproché : aucun attribut, aucune exception", () => {
      const legacy = { ...m(), matchedName: undefined } as unknown as SanctionMatch;
      const out = normalizeSanctionsIntl({ status: "ok", lists: lists(), matches: [legacy] }, { entityIds: ids });
      expect(out.entities).toHaveLength(1);
      expect(out.entities[0].attributes?.["Nom rapproché"]).toBeUndefined();
    });
  });
});
