import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.RECHERCHE_ENTREPRISES_ENABLED = "true";
});

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
      return { raw: uniteLegaleFixture, endpoint: "https://sirene.test/siren", httpStatus: 200, isFixture: false };
    },
    async getEtablissementSiege() {
      return { raw: etablissementFixture, endpoint: "https://sirene.test/siret", httpStatus: 200, isFixture: false };
    },
  },
}));

const state = vi.hoisted(() => ({ httpStatus: 200, calls: 0 }));

vi.mock("@/lib/connectors/recherche-entreprises", () => ({
  rechercheEntreprises: {
    async bySiren(siren: string) {
      state.calls += 1;
      if (state.httpStatus !== 200) {
        return {
          raw: { status: "indisponible", company: null, dirigeants: [], finances: [], labels: [], tva: [] },
          endpoint: `https://re.test/search?q=${siren} (erreur ${state.httpStatus})`,
          httpStatus: state.httpStatus,
          isFixture: false,
        };
      }
      return {
        raw: {
          status: "ok",
          company: { siren, name: "DANONE", administrativeState: "A", legalCategory: "5599", createdOn: "1899-01-01", rneUpdatedOn: "2026-02-27T11:58:00" },
          dirigeants: [
            { type: "personne physique", nom: "DUPONT", prenoms: "Alice", qualite: "Présidente", siren: null, denomination: null },
            { type: "personne morale", nom: null, prenoms: null, qualite: "Commissaire aux comptes titulaire", siren: "111222333", denomination: "CABINET AUDIT FICTIF" },
          ],
          finances: [{ annee: 2024, ca: 2000000, resultatNet: 150000 }],
          labels: ["Qualiopi"],
          tva: [],
        },
        endpoint: `https://re.test/search?q=${siren}`,
        httpStatus: 200,
        isFixture: false,
      };
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";

describe("assembleCase — Recherche d'entreprises", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    state.httpStatus = 200;
    state.calls = 0;
  });

  it("greffe dirigeants, comptes, indicateurs ; les commissaires aux comptes ne dirigent pas", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const { bundle, sources } = await assembleCase("552032534");

    expect(state.calls).toBe(1);
    expect(sources.filter((s) => s.source === "recherche_entreprises")).toHaveLength(1);

    const alice = bundle.entities.find((e) => e.label === "Alice DUPONT");
    expect(alice?.type).toBe("person");
    expect(bundle.edges.some((e) => e.type === "DIRIGE" && e.source === alice?.id)).toBe(true);
    expect(bundle.entities.some((e) => /AUDIT/.test(e.label))).toBe(false);

    const subject = bundle.entities.find((e) => e.id === "co:552032534");
    expect(subject?.attributes?.["CA (dernier exercice)"]).toContain("(2024)");
    expect(subject?.attributes?.["Indicateurs publics"]).toBe("Qualiopi");
    expect(subject?.attributes?.["Commissaires aux comptes"]).toBe("CABINET AUDIT FICTIF");
  });

  it("panne (429) : consultation tracée, aucun dirigeant inventé, dossier créé", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    state.httpStatus = 429;
    const { bundle, sources } = await assembleCase("552032534");
    const row = sources.find((s) => s.source === "recherche_entreprises");
    expect(row?.httpStatus).toBe(429);
    expect(bundle.entities.some((e) => e.type === "person")).toBe(false);
  });

  it("mode démo : jamais d'appel, aucune ligne source_records", async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    const { sources } = await assembleCase("552032534");
    expect(state.calls).toBe(0);
    expect(sources.some((s) => s.source === "recherche_entreprises")).toBe(false);
  });
});
