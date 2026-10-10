import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.RECHERCHE_ENTREPRISES_ENABLED = "true";
  process.env.GEORISQUES_ENABLED = "true";
  process.env.ANNUAIRE_ADMINISTRATION_ENABLED = "true";
});

const state = vi.hoisted(() => ({
  importOn: false,
  importMode: "ok",
  legalCategory: "5599",
  rechercheStatus: 200,
  openEstablishments: 1 as number | null,
  listed: [] as string[],
  listStatus: 200,
  calls: { imported: 0, georisques: [] as string[][], annuaire: 0, listed: 0 },
}));

vi.mock("@/lib/env", async () => ({ ...await vi.importActual("@/lib/env"), isIcpeImportEnabled: () => state.importOn }));
vi.mock("@/lib/connectors/icpe-import", () => ({ icpeImport: { async bySiren() {
  state.calls.imported++;
  if (state.importMode === "missing") return { raw: { status: "non_importe" }, endpoint: "db:icpe_sites (source non importée)", httpStatus: 503, isFixture: false };
  if (state.importMode === "failed") return { raw: { status: "indisponible" }, endpoint: "db:icpe_sites (exception)", httpStatus: 503, isFixture: false };
  const total = state.importMode === "absent" ? 0 : 50;
  return ok({ status: "ok", coverage: "national-import", importedAt: "2026-10-10T10:00:00.000Z", total, establishments: total,
    byRegime: total ? [{ label: "Autorisation", count: total }] : [], byStatus: [], bySeveso: [],
    ied: 0, nationalPriority: 0, inspections: 0, lastInspection: null, sites: [] }, "db:icpe_sites?siren=552032534");
} } }));

const ok = <T,>(raw: T, endpoint: string, httpStatus = 200) => ({
  raw,
  endpoint,
  httpStatus,
  isFixture: false,
});

vi.mock("@/lib/connectors/bodacc", () => ({
  bodacc: {
    async bySiren() {
      return ok({ results: [] }, "https://bodacc.test");
    },
  },
}));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() {
      const raw = JSON.parse(JSON.stringify(uniteLegaleFixture));
      raw.uniteLegale.periodesUniteLegale[0].categorieJuridiqueUniteLegale = state.legalCategory;
      return ok(raw, "https://sirene.test/siren");
    },
    async getEtablissementSiege() {
      return ok(etablissementFixture, "https://sirene.test/siret");
    },
    async listOpenEtablissements() {
      state.calls.listed += 1;
      if (state.listStatus !== 200) throw new Error("sirene indisponible");
      return ok({ etablissements: state.listed.map((siret) => ({ siret })) }, "https://sirene.test/list");
    },
  },
}));
vi.mock("@/lib/connectors/recherche-entreprises", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/recherche-entreprises")>(
    "@/lib/connectors/recherche-entreprises",
  );
  return {
    ...actual,
    rechercheEntreprises: {
      async bySiren(siren: string) {
        if (state.rechercheStatus !== 200) {
          return {
            raw: { status: "indisponible", company: null, dirigeants: [], finances: [], labels: [], tva: [] },
            endpoint: `https://re.test?q=${siren} (erreur ${state.rechercheStatus})`,
            httpStatus: state.rechercheStatus,
            isFixture: false,
          };
        }
        return ok(
          {
            status: "ok",
            company: {
              siren,
              name: "X",
              administrativeState: "A",
              legalCategory: state.legalCategory,
              createdOn: null,
              rneUpdatedOn: null,
              openEstablishments: state.openEstablishments,
            },
            dirigeants: [],
            finances: [],
            labels: [],
            tva: [],
            rna: null,
          },
          `https://re.test?q=${siren}`,
        );
      },
    },
  };
});
vi.mock("@/lib/connectors/georisques", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/georisques")>(
    "@/lib/connectors/georisques",
  );
  return {
    ...actual,
    georisques: {
      async bySirets(sirets: string[], options: { openTotal?: number | null } = {}) {
        state.calls.georisques.push(sirets);
        return ok(
          {
            status: "ok",
            queried: sirets.length,
            openTotal: options.openTotal ?? null,
            sites: [
              {
                siret: sirets[0],
                name: "SITE",
                commune: "ROUEN",
                regime: "Autorisation",
                seveso: "Non Seveso",
                ied: false,
                nationalPriority: false,
                status: "En exploitation avec titre",
                inspections: 1,
                lastInspection: "2026-07-21",
              },
            ],
          },
          "https://geo.test",
        );
      },
    },
  };
});
vi.mock("@/lib/connectors/annuaire-administration", () => ({
  annuaireAdministration: {
    async bySiren() {
      state.calls.annuaire += 1;
      return ok(
        { status: "ok", total: 2, services: [{ name: "Mairie", type: "mairie", url: "https://x/fiche" }] },
        "https://annuaire.test",
      );
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";

const subjectOf = (bundle: Awaited<ReturnType<typeof assembleCase>>["bundle"]) =>
  bundle.entities.find((e) => e.id === "co:552032534");

describe("assembleCase — lot réglementaire (Géorisques, Annuaire)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    state.importOn = false; state.importMode = "ok";
    state.legalCategory = "5599";
    state.rechercheStatus = 200;
    state.openEstablishments = 1;
    state.listed = [];
    state.listStatus = 200;
    state.calls = { imported: 0, georisques: [], annuaire: 0, listed: 0 };
  });

  it("import national : aucune liste Sirene ni API directe, scores inchangés", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const baseline = await assembleCase("552032534");
    state.calls.georisques = []; state.calls.listed = 0; state.openEstablishments = 3; state.importOn = true;
    const { bundle, sources } = await assembleCase("552032534");
    expect(state.calls.imported).toBe(1); expect(state.calls.listed).toBe(0); expect(state.calls.georisques).toHaveLength(0);
    expect(sources.filter(s => s.source === "georisques")).toHaveLength(1);
    expect(subjectOf(bundle)?.attributes?.["Installations classées (Géorisques)"]).toContain("50 installations classées");
    expect(bundle.case.scores).toEqual(baseline.bundle.case.scores); expect(bundle.riskSignals).toEqual(baseline.bundle.riskSignals);
    expect(bundle.events).toEqual(baseline.bundle.events);
  });
  it("absence nationale valide : aucun repli ; panne DB : consultation dégradée", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.importOn = true; state.importMode = "absent";
    const absent = await assembleCase("552032534");
    expect(subjectOf(absent.bundle)?.attributes?.["Installations classées (Géorisques)"]).toContain("Aucune installation classée rapprochée");
    state.importMode = "failed";
    const failed = await assembleCase("552032534");
    expect(subjectOf(failed.bundle)?.attributes?.["Installations classées (Géorisques)"]).toBeUndefined();
    expect(failed.sources.find(s => s.source === "georisques")?.httpStatus).toBe(503);
    expect(state.calls.georisques).toHaveLength(0); expect(state.calls.listed).toBe(0);
  });
  it("aucun import : repli direct avec couverture limitée et deux traces explicites", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"; state.importOn = true; state.importMode = "missing";
    state.openEstablishments = 100;
    const { bundle, sources } = await assembleCase("552032534");
    expect(state.calls.georisques).toHaveLength(1);
    expect(sources.filter(s => s.source === "georisques").map(s => s.httpStatus)).toEqual([503, 200]);
    expect(subjectOf(bundle)?.attributes?.["Installations classées (Géorisques)"]).toContain("import national non encore réalisé");
    expect(subjectOf(bundle)?.attributes?.["Installations classées (Géorisques)"]).toContain("couverture partielle");
  });
  it("flag national actif en démo : aucun appel ni trace d'import", async () => {
    state.importOn = true;
    const { sources } = await assembleCase("552032534");
    expect(state.calls.imported).toBe(0); expect(sources.some(s => s.source === "georisques")).toBe(false);
  });

  it("société à un seul établissement : le siège est interrogé, aucune liste Sirene", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.openEstablishments = 1;
    const { bundle, sources } = await assembleCase("552032534");
    expect(state.calls.listed).toBe(0);
    expect(state.calls.georisques).toHaveLength(1);
    expect(state.calls.georisques[0]).toHaveLength(1);
    expect(state.calls.georisques[0][0]).toMatch(/^552032534\d{5}$/);
    expect(sources.some((s) => s.source === "georisques")).toBe(true);
    expect(subjectOf(bundle)?.attributes?.["Installations classées (Géorisques)"]).toContain(
      "1 installation classée sur 1 établissement interrogé",
    );
    // Société commerciale : jamais l'annuaire de l'administration.
    expect(state.calls.annuaire).toBe(0);
    expect(sources.some((s) => s.source === "annuaire_administration")).toBe(false);
  });

  it("2 à 10 établissements ouverts : les établissements listés par Sirene sont interrogés", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.openEstablishments = 3;
    state.listed = ["55203253400703", "55203253400711", "55203253400729"];
    await assembleCase("552032534");
    expect(state.calls.listed).toBe(1);
    const queried = state.calls.georisques[0];
    expect(queried.length).toBeGreaterThanOrEqual(3);
    expect(queried).toEqual(expect.arrayContaining(state.listed));
  });

  it("plus de 10 établissements : siège seul, couverture partielle DITE, aucune liste Sirene", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.openEstablishments = 3551;
    const { bundle } = await assembleCase("552032534");
    expect(state.calls.listed).toBe(0);
    expect(state.calls.georisques[0]).toHaveLength(1);
    expect(subjectOf(bundle)?.attributes?.["Installations classées (Géorisques)"]).toContain(
      "couverture partielle : 1 établissement sur 3 551 ouverts",
    );
  });

  it("liste Sirene indisponible : repli sur le siège, sans échec du dossier", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.openEstablishments = 4;
    state.listStatus = 503;
    await assembleCase("552032534");
    expect(state.calls.georisques[0]).toHaveLength(1);
  });

  it("Recherche d'entreprises en panne : le siège est quand même interrogé", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.rechercheStatus = 503;
    await assembleCase("552032534");
    expect(state.calls.georisques).toHaveLength(1);
    expect(state.calls.georisques[0]).toHaveLength(1);
  });

  it("personne morale de droit public (7xxx) : l'annuaire est consulté", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.legalCategory = "7210";
    const { bundle, sources } = await assembleCase("552032534");
    expect(state.calls.annuaire).toBe(1);
    expect(sources.some((s) => s.source === "annuaire_administration")).toBe(true);
    expect(subjectOf(bundle)?.attributes?.["Annuaire de l'administration"]).toContain(
      "2 services référencés",
    );
  });

  it("mode démo : aucun appel, aucune ligne de source", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    state.legalCategory = "7210";
    const { sources } = await assembleCase("552032534");
    expect(state.calls.georisques).toHaveLength(0);
    expect(state.calls.annuaire).toBe(0);
    expect(sources.some((s) => s.source === "georisques" || s.source === "annuaire_administration")).toBe(false);
  });
});
