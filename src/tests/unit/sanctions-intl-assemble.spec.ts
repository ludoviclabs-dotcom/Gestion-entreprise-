import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.SANCTIONS_INTL_ENABLED = "true";
  process.env.GLEIF_ENABLED = "true";
});

const state = vi.hoisted(() => ({
  parent: true,
  calls: [] as { key: string; name: string }[][],
  response: null as null | ((queries: { key: string; name: string }[]) => unknown),
  endpoint: "db:sanctions_entries",
}));

const ok = <T,>(raw: T, endpoint: string, httpStatus = 200) => ({ raw, endpoint, httpStatus, isFixture: false });

vi.mock("@/lib/connectors/bodacc", () => ({ bodacc: { async bySiren() { return ok({ results: [] }, "https://bodacc.test"); } } }));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() { return ok(JSON.parse(JSON.stringify(uniteLegaleFixture)), "https://sirene.test/siren"); },
    async getEtablissementSiege() { return ok(etablissementFixture, "https://sirene.test/siret"); },
  },
}));
vi.mock("@/lib/connectors/gleif", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/gleif")>("@/lib/connectors/gleif");
  return {
    ...actual,
    gleif: {
      async bySiren() {
        return ok({
          subject: { lei: "SUBJECTLEI0000000001", legalName: "SOCIETE SUJET", country: "FR", registeredAs: "552032534", registrationAuthority: "RA000189" },
          directParent: state.parent
            ? { lei: "PARENTLEI00000000001", legalName: "Rosneft Oil Company", country: "RU", registeredAs: "1027700043502", registrationAuthority: "RA000439" }
            : null,
          ultimateParent: null,
        }, "https://gleif.test");
      },
    },
  };
});
vi.mock("@/lib/connectors/sanctions-intl", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/sanctions-intl")>("@/lib/connectors/sanctions-intl");
  return {
    ...actual,
    sanctionsIntl: {
      async match(queries: { key: string; name: string }[]) {
        state.calls.push(queries);
        return ok(state.response ? state.response(queries) : {}, state.endpoint);
      },
    },
  };
});

import { assembleCase } from "@/lib/ingestion/assemble-case";
import { SANCTIONS_INTL_ATTRIBUTE } from "@/lib/ingestion/normalize-sanctions-intl";
import { getSourceCoverage } from "@/lib/data/case-quality";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";

const lists = (state: "ok" | "stale" | "missing" = "ok") =>
  (["us", "uk", "un", "ch", "ca"] as const).map((key) => ({
    key, label: `Liste ${key}`, state, importedAt: "2026-10-11T04:50:00.000Z", checkedAt: "2026-10-11T04:50:00.000Z", entries: 100,
  }));
const match = (over: Record<string, unknown>) => ({
  queryKey: "subject", queryName: "SOCIETE SUJET", list: "us", listLabel: "États-Unis — liste consolidée (CSL)",
  sublist: "SDN — OFAC (Trésor)", nom: "SOCIETE SUJET LLC", matchType: "exact", score: 1, kind: "entity",
  programs: ["RUSSIA-EO14024"], countries: ["RU"], listedOn: "2022-03-24", entryKey: "e-1", ...over,
});

describe("assembleCase — listes de sanctions internationales", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.parent = true;
    state.calls.length = 0;
    state.endpoint = "db:sanctions_entries";
    state.response = () => ({ status: "ok", lists: lists(), queries: [], matches: [], truncated: false });
  });
  afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; });

  it("interroge le sujet ET la société mère GLEIF, et trace une seule source", async () => {
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].map((q) => q.key)).toEqual(["subject", "lei:PARENTLEI00000000001"]);
    expect(state.calls[0][1].name).toBe("Rosneft Oil Company");
    expect(sources.filter((s) => s.source === "sanctions_intl")).toHaveLength(1);
  });

  it("correspondance forte sur la MÈRE : nœud sanction relié à la mère, graphe et attribut", async () => {
    state.response = () => ({
      status: "ok", lists: lists(), queries: [], truncated: false,
      matches: [match({ queryKey: "lei:PARENTLEI00000000001", queryName: "Rosneft Oil Company", nom: "Rosneft Oil Company" })],
    });
    const { bundle } = await assembleCase("552032534");
    const sanction = bundle.entities.find((e) => e.type === "sanction" && e.id.startsWith("sa:intl:"));
    expect(sanction).toBeDefined();
    expect(sanction?.label).toBe("Correspondance « Rosneft Oil Company »");
    expect(sanction?.evidenceLevel).toBe("declared");
    expect(sanction?.attributes).toMatchObject({ Liste: expect.stringContaining("SDN — OFAC"), Type: "Correspondance exacte" });
    expect(bundle.edges.some((e) => e.type === "EST_VISE_PAR" && e.target === sanction?.id && e.source.includes("PARENTLEI"))).toBe(true);
    const subject = bundle.entities.find((e) => e.id === `co:552032534`);
    expect(subject?.attributes?.[SANCTIONS_INTL_ATTRIBUTE]).toContain("1 correspondance(s) retenue(s)");
    // La correspondance forte alimente le moteur de risque existant.
    expect(bundle.riskSignals.some((s) => s.ruleId === "PROXIMITE_SANCTION")).toBe(true);
  });

  it("correspondance FAIBLE (nom générique) : attribut seulement, aucun nœud ni signal", async () => {
    state.response = () => ({
      status: "ok", lists: lists(), queries: [], truncated: false,
      matches: [match({ queryName: "ATLAS", nom: "LLC Atlas", sublist: null, countries: ["Russia"] })],
    });
    const { bundle } = await assembleCase("552032534");
    expect(bundle.entities.some((e) => e.id.startsWith("sa:intl:"))).toBe(false);
    expect(bundle.riskSignals.some((s) => s.ruleId.includes("SANCTION"))).toBe(false);
    const subject = bundle.entities.find((e) => e.id === `co:552032534`);
    expect(subject?.attributes?.[SANCTIONS_INTL_ATTRIBUTE]).toMatch(/1 correspondance\(s\) faible\(s\) non retenue\(s\).*LLC Atlas/);
  });

  it("aucune correspondance : l'attribut nomme les listes consultées avec leurs dates", async () => {
    const { bundle } = await assembleCase("552032534");
    const text = bundle.entities.find((e) => e.id === `co:552032534`)?.attributes?.[SANCTIONS_INTL_ATTRIBUTE] ?? "";
    expect(text).toContain("Consultées : Liste us (vérifiée le 2026-10-11)");
    expect(text).toContain("Aucune correspondance nominative.");
  });

  it("couverture partielle : source dégradée, listes non à jour nommées, correspondances conservées", async () => {
    state.endpoint = "db:sanctions_entries (listes partielles)";
    state.response = () => ({
      status: "partiel", queries: [], truncated: false,
      lists: [...lists().slice(0, 4), { ...lists("missing")[4], importedAt: null, checkedAt: null }],
      matches: [match({ nom: "SOCIETE SUJET" })],
    });
    const { bundle, sources } = await assembleCase("552032534");
    expect(sources.find((s) => s.source === "sanctions_intl")?.endpoint).toContain("(listes partielles)");
    const text = bundle.entities.find((e) => e.id === `co:552032534`)?.attributes?.[SANCTIONS_INTL_ATTRIBUTE] ?? "";
    expect(text).toContain("Non consultées ou non à jour : Liste ca (jamais importée)");
    expect(bundle.entities.some((e) => e.id.startsWith("sa:intl:"))).toBe(true);
  });

  it("sans société mère : le sujet seul est interrogé", async () => {
    state.parent = false;
    await assembleCase("552032534");
    expect(state.calls[0].map((q) => q.key)).toEqual(["subject"]);
  });

  it("drapeau éteint ou démonstration : aucune consultation, aucune ligne de source", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    const demo = await assembleCase("552032534");
    expect(state.calls).toHaveLength(0);
    expect(demo.sources.some((s) => s.source === "sanctions_intl")).toBe(false);
  });
});

describe("couverture des contrôles de sanctions et facteurs atténuants", () => {
  const row = (source: string, endpoint = "https://x.test", httpStatus = 200) =>
    ({ source, endpoint, httpStatus, isFixture: false }) as never;

  it("« sanctions_intl » compte comme contrôle mené seulement si toutes les listes sont à jour", () => {
    const full = getSourceCoverage([row("sirene"), row("tresor_gels"), row("sanctions_intl", "db:sanctions_entries")]);
    expect(full.sanctionSources).toEqual(["tresor_gels", "sanctions_intl"]);
    const partial = getSourceCoverage([row("sirene"), row("tresor_gels"), row("sanctions_intl", "db:sanctions_entries (listes partielles)")]);
    expect(partial.sanctionSources).toEqual(["tresor_gels"]);
    const none = getSourceCoverage([row("sirene"), row("sanctions_intl", "db:sanctions_entries (source non importée)", 503)]);
    expect(none.sanctions).toBe(false);
  });

  it("le facteur « aucune entité signalée » nomme les listes et exclut les PEP", () => {
    const bundle = { case: { id: "x", title: "X", rootSiren: "552032534" }, entities: [], edges: [], events: [], riskSignals: [] } as never;
    const withIntl = computeMitigatingFactors(bundle, new Date(), {
      bodacc: true, sanctions: true, sanctionSources: ["tresor_gels", "sanctions_intl"],
    }).find((f) => f.id === "AUCUNE_ENTITE_SIGNALEE");
    expect(withIntl?.detail).toMatch(/États-Unis, Royaume-Uni, ONU, Suisse, Canada/);
    expect(withIntl?.detail).toMatch(/PEP/);
    const withOs = computeMitigatingFactors(bundle, new Date(), {
      bodacc: true, sanctions: true, sanctionSources: ["tresor_gels", "opensanctions", "sanctions_intl"],
    }).find((f) => f.id === "AUCUNE_ENTITE_SIGNALEE");
    expect(withOs?.label).toBe("Aucune entité signalée");
  });
});
