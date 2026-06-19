import { describe, expect, it } from "vitest";
import { resolveEntities } from "@/lib/ingestion/entity-resolver";
import { RESOLUTION_SANCTION } from "@/lib/risk/rules";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/types";
import { buildGraph } from "@/lib/graph/build-graph";
import type { CaseBundle, CaseEntity, CaseEdge } from "@/lib/graph/graph-types";

function company(
  id: string,
  label: string,
  siren?: string,
  level: CaseEntity["evidenceLevel"] = "confirmed",
): CaseEntity {
  return {
    id,
    type: "company",
    label,
    evidenceLevel: level,
    attributes: siren ? { SIREN: siren } : {},
  };
}
function person(id: string, label: string): CaseEntity {
  return { id, type: "person", label, evidenceLevel: "declared", attributes: {} };
}

describe("resolveEntities", () => {
  const input = {
    entities: [
      company("co:111", "DUPONT SARL", "111111111", "confirmed"),
      company("co:dupont", "Dupont S.A.R.L."),
      company("co:222", "MARTIN HOLDING", "222222222"),
      company("co:alpha1", "ALPHA", "333333333"),
      company("co:alpha2", "Alpha", "444444444"),
      person("pe:jean-martin", "Jean Martin"),
      person("pe:j-martin", "J. Martin"),
    ],
    edges: [
      {
        id: "e1",
        type: "DIRIGE",
        source: "pe:jean-martin",
        target: "co:111",
        evidenceLevel: "declared",
      },
      {
        id: "e2",
        type: "DIRIGE",
        source: "pe:j-martin",
        target: "co:dupont",
        evidenceLevel: "confirmed",
      },
    ] as CaseEdge[],
  };

  it("fusionne sociétés (SIREN/dénomination) et personnes (nom flou)", () => {
    const r = resolveEntities(input);
    expect(r.idMap["co:dupont"]).toBe("co:111");
    expect(r.idMap["pe:j-martin"]).toBe("pe:jean-martin");
    // 5 entités canoniques : co:111, co:222, co:alpha1, co:alpha2, pe:jean-martin
    expect(r.entities).toHaveLength(5);
    const dupont = r.entities.find((e) => e.id === "co:111");
    expect(dupont?.attributes?.["Entités fusionnées"]).toBe("2");
    expect(dupont?.attributes?.["__mergedFrom"]).toBeTruthy();
    expect(r.merges).toHaveLength(2);
  });

  it("ne fusionne jamais deux SIREN distincts (même dénomination)", () => {
    const r = resolveEntities(input);
    expect(r.idMap["co:alpha1"]).toBe("co:alpha1");
    expect(r.idMap["co:alpha2"]).toBe("co:alpha2");
  });

  it("re-pointe les arêtes, supprime les doublons en gardant la preuve la plus forte", () => {
    const r = resolveEntities(input);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0].source).toBe("pe:jean-martin");
    expect(r.edges[0].target).toBe("co:111");
    expect(r.edges[0].evidenceLevel).toBe("confirmed");
  });

  it("est idempotent : une seconde passe ne fusionne plus rien", () => {
    const first = resolveEntities(input);
    const second = resolveEntities({
      entities: first.entities,
      edges: first.edges,
    });
    expect(second.entities).toHaveLength(first.entities.length);
    expect(second.merges).toHaveLength(0);
  });
});

describe("resolveEntities — garde-fous de précision", () => {
  it("ne fusionne pas des prénoms distincts (Jean/Jeanne) sans date de naissance", () => {
    const r = resolveEntities({
      entities: [
        person("pe:jean-martin", "Jean Martin"),
        person("pe:jeanne-martin", "Jeanne Martin"),
      ],
      edges: [],
    });
    expect(r.entities).toHaveLength(2);
  });

  it("ne fusionne pas « Marie Claire Dupont » et « Marie Dupont »", () => {
    const r = resolveEntities({
      entities: [
        person("pe:mcd", "Marie Claire Dupont"),
        person("pe:md", "Marie Dupont"),
      ],
      edges: [],
    });
    expect(r.entities).toHaveLength(2);
  });

  it("fusionne des noms de personne inversés (« Jean Martin » / « Martin Jean »)", () => {
    const r = resolveEntities({
      entities: [
        person("pe:jean-martin", "Jean Martin"),
        person("pe:martin-jean", "Martin Jean"),
      ],
      edges: [],
    });
    expect(r.entities).toHaveLength(1);
  });

  it("ne fusionne pas « MARTIN HOLDING » et « MARTIN SAS » (holding distinctif)", () => {
    const r = resolveEntities({
      entities: [company("co:1", "MARTIN HOLDING"), company("co:2", "MARTIN SAS")],
      edges: [],
    });
    expect(r.entities).toHaveLength(2);
  });

  it("garde-fou naissance TRANSITIF : pas de groupe à deux années via un pont", () => {
    const withBirth = (id: string, year?: number): CaseEntity => ({
      ...person(id, "Jean Martin"),
      attributes: year ? { Naissance: String(year) } : {},
    });
    const r = resolveEntities({
      entities: [withBirth("pe:a", 1970), withBirth("pe:b"), withBirth("pe:c", 1990)],
      edges: [],
    });
    // Les personnes nées en 1970 et 1990 ne partagent jamais la même canonique.
    expect(r.idMap["pe:a"]).not.toBe(r.idMap["pe:c"]);
  });

  it("provenance CUMULATIVE à la re-résolution (ajout d'un doublon)", () => {
    const first = resolveEntities({
      entities: [company("co:111", "DUPONT", "111111111"), company("co:dup", "Dupont")],
      edges: [],
    });
    expect(
      first.entities.find((e) => e.id === "co:111")?.attributes?.[
        "Entités fusionnées"
      ],
    ).toBe("2");

    const second = resolveEntities({
      entities: [...first.entities, company("co:dup2", "Dupont")],
      edges: [],
    });
    const canon = second.entities.find((e) => e.id === "co:111");
    expect(canon?.attributes?.["Entités fusionnées"]).toBe("3");
    const ids = (
      JSON.parse(canon?.attributes?.["__mergedFrom"] ?? "[]") as {
        id: string;
      }[]
    ).map((m) => m.id);
    expect(ids).toContain("co:dup");
    expect(ids).toContain("co:dup2");
  });
});

describe("RESOLUTION_SANCTION", () => {
  it("rapproche un dirigeant non adjacent d'une sanction homonyme", () => {
    const bundle: CaseBundle = {
      case: { id: "x", title: "x", rootSiren: "x" },
      entities: [
        person("pe:jean-martin", "Jean Martin"),
        {
          id: "sa:os:1",
          type: "sanction",
          label: "Correspondance « Jean Martin »",
          evidenceLevel: "simulated",
        },
        company("co:1", "ACME SAS", "555555555"),
      ],
      edges: [
        {
          id: "e:co:1:sa",
          type: "EST_VISE_PAR",
          source: "co:1",
          target: "sa:os:1",
          evidenceLevel: "simulated",
        },
      ],
      events: [],
      riskSignals: [],
    };
    const graph = buildGraph(bundle);
    const signals = RESOLUTION_SANCTION.evaluate({
      bundle,
      graph,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].subjectId).toBe("pe:jean-martin");
    expect(signals[0].severity).toBe("high");
    expect(signals[0].explanation).not.toMatch(/fraude|coupable|criminel/i);
  });

  it("ne se déclenche pas pour une paire déjà reliée par une arête", () => {
    const bundle: CaseBundle = {
      case: { id: "x", title: "x", rootSiren: "x" },
      entities: [
        company("co:1", "MARTIN HOLDING", "555555555"),
        {
          id: "sa:os:1",
          type: "sanction",
          label: "Correspondance « MARTIN HOLDING »",
          evidenceLevel: "declared",
        },
      ],
      edges: [
        {
          id: "e:co:1:sa",
          type: "EST_VISE_PAR",
          source: "co:1",
          target: "sa:os:1",
          evidenceLevel: "declared",
        },
      ],
      events: [],
      riskSignals: [],
    };
    const graph = buildGraph(bundle);
    const signals = RESOLUTION_SANCTION.evaluate({
      bundle,
      graph,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(0);
  });

  it("plafonne à 'medium' deux entités ne différant que par la forme juridique", () => {
    const bundle: CaseBundle = {
      case: { id: "x", title: "x", rootSiren: "x" },
      entities: [
        company("co:1", "MARTIN HOLDING SAS", "555555555"),
        {
          id: "sa:os:1",
          type: "sanction",
          label: "Correspondance « MARTIN HOLDING LTD »",
          evidenceLevel: "simulated",
        },
      ],
      edges: [],
      events: [],
      riskSignals: [],
    };
    const graph = buildGraph(bundle);
    const signals = RESOLUTION_SANCTION.evaluate({
      bundle,
      graph,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].severity).toBe("medium");
  });
});
