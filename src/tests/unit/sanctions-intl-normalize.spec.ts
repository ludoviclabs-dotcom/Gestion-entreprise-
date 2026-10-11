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
});
