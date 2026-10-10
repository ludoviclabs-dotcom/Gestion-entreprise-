import { describe, it, expect, afterEach, vi } from "vitest";
import uniteLegaleFixture from "@/lib/fixtures/sirene-unite-legale.sample.json";
import etablissementFixture from "@/lib/fixtures/sirene-etablissement.sample.json";

vi.hoisted(() => {
  process.env.RECHERCHE_ENTREPRISES_ENABLED = "true";
  process.env.RGE_ENABLED = "true";
});

/**
 * GDELT (≈ 10 s en production) ne doit PAS retarder les seconds sauts : le détail
 * des labels (dépend de Recherche d'entreprises) démarre dès que Recherche a
 * répondu. Ici GDELT n'est libéré QUE lorsque RGE a été appelé : si le second
 * saut attendait la fin de GDELT, le test resterait bloqué.
 */
const gate = vi.hoisted(() => {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { opened, release, order: [] as string[] };
});

const ok = <T,>(raw: T, endpoint: string) => ({
  raw,
  endpoint,
  httpStatus: 200,
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
        return ok(
          {
            status: "ok",
            company: { siren, name: "X", administrativeState: "A", legalCategory: "5599", createdOn: null, rneUpdatedOn: null },
            dirigeants: [],
            finances: [],
            labels: ["RGE"],
            tva: [],
            rna: null,
          },
          "https://re.test",
        );
      },
    },
  };
});
vi.mock("@/lib/connectors/gdelt", () => ({
  gdelt: {
    async byName() {
      await gate.opened; // libéré seulement après l'appel RGE
      gate.order.push("gdelt");
      return ok({ articles: [] }, "https://gdelt.test");
    },
  },
}));
vi.mock("@/lib/connectors/rge", () => ({
  rge: {
    async bySiren() {
      gate.order.push("rge");
      gate.release();
      return ok({ status: "ok", total: 0, lines: [] }, "https://ademe.test");
    },
  },
}));

import { assembleCase } from "@/lib/ingestion/assemble-case";

describe("assembleCase — chronométrage et seconds sauts", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
  });

  it("un second saut n'attend pas la source la plus lente (GDELT)", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    await assembleCase("552032534");
    expect(gate.order).toEqual(["rge", "gdelt"]);
  });

  it("renvoie la durée de chaque source interrogée et le total", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    const { timings } = await assembleCase("552032534");
    for (const key of ["sirene", "sirene_siege", "ban", "bodacc", "gdelt", "recherche_entreprises", "rge", "_total"]) {
      expect(typeof timings[key], key).toBe("number");
      expect(timings[key]).toBeGreaterThanOrEqual(0);
    }
    expect(timings._total).toBeGreaterThanOrEqual(timings.gdelt);
    // Source non interrogée (label absent, flag éteint) : aucune durée inventée.
    expect(timings.qualiopi).toBeUndefined();
    expect(timings.balo).toBeUndefined();
  });
});
