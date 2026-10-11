import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.SANCTIONS_INTL_ENABLED = "true";
  process.env.SANCTIONS_PERSONS_ENABLED = "true";
  process.env.RECHERCHE_ENTREPRISES_ENABLED = "true";
});

const state = vi.hoisted(() => ({
  calls: [] as { key: string; name: string; birthYears: number[] }[][],
  response: null as null | ((q: { key: string; name: string; birthYears: number[] }[]) => unknown),
  endpoint: "db:sanctions_entries",
  httpStatus: 200,
}));

const ok = <T,>(raw: T, endpoint: string, httpStatus = 200) => ({ raw, endpoint, httpStatus, isFixture: false });

vi.mock("@/lib/connectors/bodacc", () => ({ bodacc: { async bySiren() { return ok({ results: [] }, "https://bodacc.test"); } } }));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() { return ok(JSON.parse(JSON.stringify(uniteLegaleFixture)), "https://sirene.test/siren"); },
    async getEtablissementSiege() { return ok(etablissementFixture, "https://sirene.test/siret"); },
  },
}));
vi.mock("@/lib/connectors/pappers", () => ({
  pappers: { async bySiren(siren: string) { return { raw: {}, endpoint: `fixture:pappers:${siren}`, httpStatus: 0, isFixture: true }; } },
}));
vi.mock("@/lib/connectors/recherche-entreprises", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/recherche-entreprises")>(
    "@/lib/connectors/recherche-entreprises",
  );
  return {
    ...actual,
    rechercheEntreprises: {
      async bySiren(siren: string) {
        return ok({
          status: "ok",
          company: { siren, name: "SOCIETE SUJET", administrativeState: "A", legalCategory: "5599", createdOn: "1999-01-01", rneUpdatedOn: "2026-02-27T11:58:00" },
          dirigeants: [
            { type: "personne physique", nom: "LUKASHENKA", prenoms: "Dzmitry", qualite: "Président", siren: null, denomination: null, anneeNaissance: 1980 },
            { type: "personne physique", nom: "DUPONT", prenoms: "Jean", qualite: "Directeur général", siren: null, denomination: null, anneeNaissance: null },
          ],
          finances: [], labels: [], tva: [],
        }, `https://re.test/search?q=${siren}`);
      },
    },
  };
});
vi.mock("@/lib/connectors/sanctions-intl", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/sanctions-intl")>("@/lib/connectors/sanctions-intl");
  return {
    ...actual,
    sanctionsIntl: {
      async match() {
        return ok({ status: "ok", lists: [], queries: [], matches: [], truncated: false }, "db:sanctions_entries");
      },
    },
  };
});
vi.mock("@/lib/connectors/sanctions-persons", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/sanctions-persons")>("@/lib/connectors/sanctions-persons");
  return {
    ...actual,
    sanctionsPersons: {
      async match(queries: { key: string; name: string; birthYears: number[] }[]) {
        state.calls.push(queries);
        return ok(state.response ? state.response(queries) : {}, state.endpoint, state.httpStatus);
      },
    },
  };
});

import { assembleCase } from "@/lib/ingestion/assemble-case";
import { SANCTIONS_PERSONS_ATTRIBUTE, PERSON_MATCH_ATTRIBUTE } from "@/lib/ingestion/normalize-sanctions-persons";

const lists = () =>
  (["us", "uk", "un", "ch", "ca"] as const).map((key) => ({
    key, label: `Liste ${key}`, state: "ok", importedAt: "2026-10-12T04:50:00.000Z", checkedAt: "2026-10-12T04:50:00.000Z", entries: 100,
  }));
const personMatch = (over: Record<string, unknown>) => ({
  queryKey: "pe:dzmitry-lukashenka", queryName: "Dzmitry LUKASHENKA", list: "us", listLabel: "États-Unis — liste consolidée (CSL)",
  sublist: "SDN — OFAC (Trésor)", nom: "Dzmitry LUKASHENKA", matchedName: "Dzmitry LUKASHENKA", name: "exact", birth: "corroborated",
  birthYears: [1980], programs: ["BELARUS"], countries: ["Belarus"], listedOn: "2020-09-28", entryKey: "p-1", ...over,
});

describe("assembleCase — contrôle des dirigeants contre les listes de sanctions", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.calls.length = 0;
    state.endpoint = "db:sanctions_entries";
    state.httpStatus = 200;
    state.response = () => ({ status: "ok", lists: lists(), queried: 2, notQueried: 0, withBirthYear: 1, matches: [], excluded: 0, truncated: false });
  });
  afterEach(() => { delete process.env.NEXT_PUBLIC_DEMO_MODE; });

  it("interroge les dirigeants avec leur année de naissance, sans l'ajouter à la fiche", async () => {
    const { bundle } = await assembleCase("552032534");
    expect(state.calls).toHaveLength(1);
    const byName = Object.fromEntries(state.calls[0].map((q) => [q.name, q.birthYears]));
    expect(byName["Dzmitry LUKASHENKA"]).toEqual([1980]);
    expect(byName["Jean DUPONT"]).toEqual([]);
    // Jamais affichée : ni attribut, ni libellé ne porte l'année de naissance.
    for (const e of bundle.entities.filter((x) => x.type === "person")) {
      expect(JSON.stringify(e)).not.toMatch(/1980/);
    }
  });

  it("correspondance corroborée : nœud sanction « simulé » relié à la personne, signaux de proximité", async () => {
    state.response = () => ({
      status: "ok", lists: lists(), queried: 2, notQueried: 0, withBirthYear: 1, excluded: 0, truncated: false,
      matches: [personMatch({})],
    });
    const { bundle, sources } = await assembleCase("552032534");
    const person = bundle.entities.find((e) => e.type === "person" && /LUKASHENKA/i.test(e.label));
    const sanction = bundle.entities.find((e) => e.type === "sanction" && e.id.startsWith("sa:intl:p:"));
    expect(person && sanction).toBeTruthy();
    expect(sanction?.evidenceLevel).toBe("simulated");
    expect(sanction?.attributes).toMatchObject({ Type: "Nom identique, naissance concordante", "Année de naissance concordante": "1980" });
    expect(bundle.edges.some((e) => e.type === "EST_VISE_PAR" && e.source === person!.id && e.target === sanction!.id)).toBe(true);
    // Le moteur de risque existant s'en saisit : la personne (1 saut) puis la société (2 sauts).
    const signals = bundle.riskSignals.filter((s) => s.ruleId === "PROXIMITE_SANCTION");
    expect(signals.some((s) => s.subjectId === person!.id)).toBe(true);
    // Une seule ligne de source « sanctions_intl », qui porte aussi le contrôle des personnes.
    const rows = sources.filter((s) => s.source === "sanctions_intl");
    expect(rows).toHaveLength(1);
    expect((rows[0].raw as { personnes?: { queried: number } }).personnes?.queried).toBe(2);
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    expect(subject?.attributes?.[SANCTIONS_PERSONS_ATTRIBUTE]).toContain("1 correspondance(s) corroborée(s)");
  });

  it("homonyme sans corroboration : attribut sur la personne, aucun nœud ni signal", async () => {
    state.response = () => ({
      status: "ok", lists: lists(), queried: 2, notQueried: 0, withBirthYear: 1, excluded: 0, truncated: false,
      matches: [personMatch({ queryKey: "pe:jean-dupont", queryName: "Jean DUPONT", nom: "Jean DUPONT", matchedName: "Jean DUPONT", birth: "unknown", birthYears: [1960] })],
    });
    const { bundle } = await assembleCase("552032534");
    expect(bundle.entities.some((e) => e.id.startsWith("sa:intl:p:"))).toBe(false);
    expect(bundle.riskSignals.some((s) => s.ruleId.includes("SANCTION"))).toBe(false);
    const jean = bundle.entities.find((e) => e.type === "person" && /DUPONT/i.test(e.label));
    expect(jean?.attributes?.[PERSON_MATCH_ATTRIBUTE]).toContain("sans corroboration");
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    expect(subject?.attributes?.[SANCTIONS_PERSONS_ATTRIBUTE]).toMatch(/1 homonyme\(s\) possible\(s\)/);
  });

  it("contrôle indisponible : dit, sans casser le dossier ni inventer une absence", async () => {
    state.endpoint = "db:sanctions_entries (exception)";
    state.httpStatus = 503;
    state.response = () => ({ status: "indisponible", lists: [], queried: 0, notQueried: 0, withBirthYear: 0, matches: [], excluded: 0, truncated: false });
    const { bundle } = await assembleCase("552032534");
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    const text = subject?.attributes?.[SANCTIONS_PERSONS_ATTRIBUTE] ?? "";
    expect(text).toContain("indisponible");
    expect(text).not.toContain("Aucune correspondance");
  });
});
