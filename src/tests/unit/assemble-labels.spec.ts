import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.RECHERCHE_ENTREPRISES_ENABLED = "true";
  process.env.RGE_ENABLED = "true";
  process.env.AGENCE_BIO_ENABLED = "true";
  process.env.ALIM_CONFIANCE_ENABLED = "true";
  process.env.QUALIOPI_ENABLED = "true";
});

const state = vi.hoisted(() => ({
  labels: ["RGE", "Agriculture biologique", "Alim'confiance", "Qualiopi"] as string[],
  rechercheStatus: 200,
  rgeStatus: 200,
  calls: { rge: 0, bio: 0, alim: 0, qualiopi: 0 },
}));

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
      return ok(JSON.parse(JSON.stringify(uniteLegaleFixture)), "https://sirene.test/siren");
    },
    async getEtablissementSiege() {
      return ok(etablissementFixture, "https://sirene.test/siret");
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
            company: { siren, name: "SOCIETE X", administrativeState: "A", legalCategory: "5599", createdOn: null, rneUpdatedOn: null },
            dirigeants: [],
            finances: [],
            labels: state.labels,
            tva: [],
            rna: null,
          },
          `https://re.test?q=${siren}`,
        );
      },
    },
  };
});

vi.mock("@/lib/connectors/rge", () => ({
  rge: {
    async bySiren(siren: string) {
      state.calls.rge += 1;
      if (state.rgeStatus !== 200) {
        return {
          raw: { status: "indisponible", total: 0, lines: [] },
          endpoint: `https://ademe.test?siren=${siren} (erreur ${state.rgeStatus})`,
          httpStatus: state.rgeStatus,
          isFixture: false,
        };
      }
      return ok(
        {
          status: "ok",
          total: 2,
          lines: [
            { siret: `${siren}00011`, code: "C1", qualification: "Q1", domain: "Rénovation globale", body: "qualibat", from: "2025-01-01", to: "2029-01-01" },
          ],
        },
        `https://ademe.test?siren=${siren}`,
      );
    },
  },
}));
vi.mock("@/lib/connectors/agence-bio", () => ({
  agenceBio: {
    async bySiren(siren: string) {
      state.calls.bio += 1;
      return ok(
        {
          status: "ok",
          total: 3,
          operators: [
            { siret: `${siren}00011`, categories: [], certificates: [{ body: "Ecocert", state: "ENGAGEE", engagedOn: "2015-05-05", suspendedOn: null, stoppedOn: null }] },
          ],
        },
        `https://bio.test?siret=${siren}`,
      );
    },
  },
}));
vi.mock("@/lib/connectors/alim-confiance", () => ({
  alimConfiance: {
    async bySiren(siren: string) {
      state.calls.alim += 1;
      return ok(
        { status: "ok", total: 4, levels: [{ level: "Satisfaisant", count: 4, latest: "2026-05-05" }] },
        `https://dgal.test?siren=${siren}`,
      );
    },
  },
}));
vi.mock("@/lib/connectors/qualiopi", () => ({
  qualiopi: {
    async bySiren(siren: string) {
      state.calls.qualiopi += 1;
      return ok(
        {
          status: "ok",
          total: 1,
          organisations: [{ nda: "11755589375", name: "X", siret: null, categories: ["actions de formation"] }],
        },
        `https://dgefp.test?siren=${siren}`,
      );
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";

describe("assembleCase — lot labels (RGE, Agence BIO, Alim'confiance, Qualiopi)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    state.labels = ["RGE", "Agriculture biologique", "Alim'confiance", "Qualiopi"];
    state.rechercheStatus = 200;
    state.rgeStatus = 200;
    state.calls = { rge: 0, bio: 0, alim: 0, qualiopi: 0 };
  });

  const subjectOf = (bundle: Awaited<ReturnType<typeof assembleCase>>["bundle"]) =>
    bundle.entities.find((e) => e.id === "co:552032534");

  it("quatre labels signalés : 4 consultations, 4 lignes de source, 4 attributs", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const { bundle, sources } = await assembleCase("552032534");

    expect(state.calls).toEqual({ rge: 1, bio: 1, alim: 1, qualiopi: 1 });
    expect(sources.map((s) => s.source)).toEqual(
      expect.arrayContaining(["rge", "agence_bio", "alim_confiance", "qualiopi"]),
    );
    const attrs = subjectOf(bundle)?.attributes ?? {};
    expect(attrs["RGE (ADEME)"]).toContain("1 qualification sur 1 établissement");
    expect(attrs["Agriculture biologique (Agence BIO)"]).toContain("3 établissements enregistrés");
    expect(attrs["Contrôles sanitaires publiés (Alim'confiance)"]).toContain("4 contrôles publiés");
    expect(attrs["Organisme de formation (DGEFP)"]).toContain("actions de formation");
    // Aucun événement ni signal de risque issu d'un label.
    expect(bundle.events.some((e) => /rge|bio|qualiopi|alim/i.test(e.kind))).toBe(false);
  });

  it("seul le label signalé déclenche son connecteur (RGE seul)", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.labels = ["RGE"];
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toEqual({ rge: 1, bio: 0, alim: 0, qualiopi: 0 });
    expect(sources.some((s) => s.source === "agence_bio")).toBe(false);
    expect(sources.some((s) => s.source === "alim_confiance")).toBe(false);
    expect(sources.some((s) => s.source === "qualiopi")).toBe(false);
  });

  it("aucun label signalé : aucun appel ni ligne de source (jamais une absence inventée)", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.labels = ["ESS"];
    const { bundle, sources } = await assembleCase("552032534");
    expect(state.calls).toEqual({ rge: 0, bio: 0, alim: 0, qualiopi: 0 });
    expect(sources.some((s) => ["rge", "agence_bio", "alim_confiance", "qualiopi"].includes(s.source))).toBe(false);
    expect(subjectOf(bundle)?.attributes?.["RGE (ADEME)"]).toBeUndefined();
  });

  it("Recherche d'entreprises en panne : les labels sont inconnus → aucun appel", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.rechercheStatus = 503;
    await assembleCase("552032534");
    expect(state.calls).toEqual({ rge: 0, bio: 0, alim: 0, qualiopi: 0 });
  });

  it("panne RGE : consultation tracée, aucun attribut inventé, le dossier se crée", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.rgeStatus = 503;
    const { bundle, sources } = await assembleCase("552032534");
    expect(sources.find((s) => s.source === "rge")?.httpStatus).toBe(503);
    expect(subjectOf(bundle)?.attributes?.["RGE (ADEME)"]).toBeUndefined();
    // Les autres labels ne sont pas affectés.
    expect(subjectOf(bundle)?.attributes?.["Organisme de formation (DGEFP)"]).toBeDefined();
  });

  it("mode démo : aucun appel, aucune ligne de source", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toEqual({ rge: 0, bio: 0, alim: 0, qualiopi: 0 });
    expect(sources.some((s) => ["rge", "agence_bio", "alim_confiance", "qualiopi"].includes(s.source))).toBe(false);
  });
});
