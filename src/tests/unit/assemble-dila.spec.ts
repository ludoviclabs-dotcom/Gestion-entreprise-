import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.BALO_ENABLED = "true";
  process.env.BOAMP_ENABLED = "true";
  process.env.DCA_ENABLED = "true";
  process.env.JOAFE_ENABLED = "true";
});

const state = vi.hoisted(() => ({
  legalCategory: "5599",
  baloStatus: 200,
  calls: { balo: 0, boamp: 0, dca: 0, joafe: [] as string[] },
  dcaRna: "W751000001" as string | null,
}));

vi.mock("@/lib/connectors/bodacc", () => ({
  bodacc: {
    async bySiren() {
      return { raw: { results: [] }, endpoint: "https://bodacc.test", httpStatus: 200, isFixture: false };
    },
  },
}));
vi.mock("@/lib/connectors/sirene", () => ({
  sirene: {
    async getUniteLegale() {
      const raw = JSON.parse(JSON.stringify(uniteLegaleFixture));
      raw.uniteLegale.periodesUniteLegale[0].categorieJuridiqueUniteLegale = state.legalCategory;
      return { raw, endpoint: "https://sirene.test/siren", httpStatus: 200, isFixture: false };
    },
    async getEtablissementSiege() {
      return { raw: etablissementFixture, endpoint: "https://sirene.test/siret", httpStatus: 200, isFixture: false };
    },
  },
}));

const ok = <T,>(raw: T, endpoint: string) => ({ raw, endpoint, httpStatus: 200, isFixture: false });

vi.mock("@/lib/connectors/balo", () => ({
  balo: {
    async bySiren(siren: string) {
      state.calls.balo += 1;
      if (state.baloStatus !== 200) {
        return {
          raw: { status: "indisponible", total: 0, items: [] },
          endpoint: `https://dila.test/balo?siren=${siren} (erreur ${state.baloStatus})`,
          httpStatus: state.baloStatus,
          isFixture: false,
        };
      }
      return ok(
        {
          status: "ok",
          total: 14,
          items: [{ id: "B1", date: "2026-08-03", category: "Comptes annuels", numero: "2603311", names: ["X"], otherSirens: [] }],
        },
        `https://dila.test/balo?siren=${siren}`,
      );
    },
  },
}));
vi.mock("@/lib/connectors/boamp", () => ({
  boamp: {
    async bySiren(siren: string) {
      state.calls.boamp += 1;
      return ok(
        {
          status: "ok",
          total: 2,
          items: [{ id: "26-1", date: "2026-09-24", buyer: "Commune X", titulaires: ["A"], object: null, url: null }],
        },
        `https://boamp.test?siren=${siren}`,
      );
    },
  },
}));
vi.mock("@/lib/connectors/associations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/associations")>(
    "@/lib/connectors/associations",
  );
  return {
    ...actual,
    dca: {
      async bySiren(siren: string) {
        state.calls.dca += 1;
        return ok(
          {
            status: "ok",
            total: 3,
            rna: state.dcaRna,
            items: [{ id: "d1", date: "2026-03-02", closedOn: "2025-12-31", type: null, state: null, category: null, title: null, titleNew: null, titleOld: null, rna: state.dcaRna }],
          },
          `https://dila.test/dca?siren=${siren}`,
        );
      },
    },
    joafe: {
      async byRna(rna: string) {
        state.calls.joafe.push(rna);
        return ok(
          {
            status: "ok",
            total: 1,
            rna,
            items: [{ id: "j1", date: "2026-10-06", closedOn: null, type: "Création", state: "Initial", category: null, title: "X", titleNew: null, titleOld: null, rna }],
          },
          `https://dila.test/joafe?rna=${rna}`,
        );
      },
    },
  };
});

import { assembleCase } from "@/lib/ingestion/assemble-case";

describe("assembleCase — lot DILA (BALO, BOAMP, DCA, JOAFE)", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    state.legalCategory = "5599";
    state.baloStatus = 200;
    state.dcaRna = "W751000001";
    state.calls = { balo: 0, boamp: 0, dca: 0, joafe: [] };
  });

  it("société commerciale : BALO et BOAMP seulement (aucun appel « associations »)", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const { bundle, sources } = await assembleCase("552032534");

    expect(state.calls.balo).toBe(1);
    expect(state.calls.boamp).toBe(1);
    expect(state.calls.dca).toBe(0);
    expect(state.calls.joafe).toEqual([]);
    expect(sources.map((s) => s.source)).toEqual(expect.arrayContaining(["balo", "boamp"]));
    expect(sources.some((s) => s.source === "dca" || s.source === "joafe")).toBe(false);

    const kinds = bundle.events.map((e) => e.kind);
    expect(kinds).toContain("annonce_financiere");
    expect(kinds).toContain("marche_public_resultat");
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    expect(subject?.attributes?.["Annonces BALO (total)"]).toBe("14");
    expect(subject?.attributes?.["Avis de résultat BOAMP mentionnant l'entreprise"]).toBe("2");
    // Les événements pointent vers le nœud société CANONIQUE.
    const ids = new Set(bundle.entities.map((e) => e.id));
    expect(bundle.events.every((e) => ids.has(e.entityId))).toBe(true);
  });

  it("association (catégorie 9xxx) : DCA puis JOAFE avec le RNA lu dans les comptes", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.legalCategory = "9220";
    const { bundle, sources } = await assembleCase("552032534");

    expect(state.calls.dca).toBe(1);
    expect(state.calls.joafe).toEqual(["W751000001"]);
    expect(sources.map((s) => s.source)).toEqual(expect.arrayContaining(["dca", "joafe"]));
    const kinds = bundle.events.map((e) => e.kind);
    expect(kinds).toContain("depot_comptes_association");
    expect(kinds).toContain("annonce_association");
    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    expect(subject?.attributes?.["Dépôts de comptes d'association (total)"]).toBe("3");
    expect(subject?.attributes?.["Annonces JOAFE (total)"]).toBe("1");
  });

  it("association sans RNA connu : JOAFE n'est pas interrogé (aucune ligne de source)", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.legalCategory = "9220";
    state.dcaRna = null;
    const { sources } = await assembleCase("552032534");
    expect(state.calls.joafe).toEqual([]);
    expect(sources.some((s) => s.source === "joafe")).toBe(false);
  });

  it("panne BALO : consultation tracée, aucun événement inventé, le dossier se crée", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.baloStatus = 503;
    const { bundle, sources } = await assembleCase("552032534");
    expect(sources.find((s) => s.source === "balo")?.httpStatus).toBe(503);
    expect(bundle.events.some((e) => e.kind === "annonce_financiere")).toBe(false);
    expect(bundle.entities.find((e) => e.id === "co:552032534")?.attributes?.["Annonces BALO (total)"]).toBeUndefined();
  });

  it("mode démo : aucun appel, aucune ligne de source", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    const { sources } = await assembleCase("552032534");
    expect(state.calls.balo + state.calls.boamp + state.calls.dca).toBe(0);
    expect(sources.some((s) => ["balo", "boamp", "dca", "joafe"].includes(s.source))).toBe(false);
  });
});
