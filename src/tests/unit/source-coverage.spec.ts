import { describe, it, expect } from "vitest";
import { getSourceCoverage, getSourceHealth } from "@/lib/data/case-quality";
import { computeMitigatingFactors } from "@/lib/risk/mitigating";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import type { SourceRow } from "@/lib/data/types";
import type { CaseBundle } from "@/lib/graph/graph-types";

const live = (source: SourceRow["source"], extra: Partial<SourceRow> = {}): SourceRow => ({
  source,
  endpoint: `https://api.test/${source}`,
  httpStatus: 200,
  isFixture: false,
  ...extra,
});
const fixture = (source: SourceRow["source"], endpoint = `fixture:${source}`): SourceRow => ({
  source,
  endpoint,
  httpStatus: 0,
  isFixture: true,
});

const emptyBundle: CaseBundle = {
  case: { id: "c", title: "SOCIETE", rootSiren: "123456789" },
  entities: [
    {
      id: "co:123456789",
      type: "company",
      label: "SOCIETE",
      evidenceLevel: "declared",
      attributes: { SIREN: "123456789" },
    },
  ],
  edges: [],
  events: [],
  riskSignals: [],
};
const ids = (rows: ReturnType<typeof computeMitigatingFactors>) => rows.map((f) => f.id);

describe("isDegradedEndpoint", () => {
  it("reconnaît les suffixes posés par les connecteurs", () => {
    expect(isDegradedEndpoint("https://x/y (exception)")).toBe(true);
    expect(isDegradedEndpoint("https://x/y (erreur 401)")).toBe(true);
    expect(isDegradedEndpoint("https://x/y (schéma non reconnu)")).toBe(true);
    expect(isDegradedEndpoint("https://x/y")).toBe(false);
    expect(isDegradedEndpoint("fixture:bodacc(repli)")).toBe(false);
  });
});

describe("getSourceHealth — consultations dégradées", () => {
  it("compte un HTTP 200 au contenu inexploitable comme un échec", () => {
    const health = getSourceHealth([
      live("sirene"),
      live("tresor_gels", { endpoint: "https://x (schéma non reconnu)" }),
      live("gleif", { httpStatus: 0, endpoint: "https://x (exception)" }),
    ]);
    expect(health.failed).toBe(2);
  });

  it("ne compte pas un repli fixture comme un échec applicatif", () => {
    expect(getSourceHealth([live("sirene"), fixture("bodacc")]).failed).toBe(0);
  });
});

describe("getSourceCoverage", () => {
  it("dossier 100 % fixture (démonstration) : tout est couvert", () => {
    expect(getSourceCoverage([fixture("sirene"), fixture("bodacc")])).toEqual({
      bodacc: true,
      sanctions: true,
    });
  });

  it("dossier réel : un contrôle désactivé (fixture) ne couvre rien", () => {
    const cov = getSourceCoverage([
      live("sirene"),
      live("bodacc"),
      fixture("tresor_gels"),
      fixture("opensanctions"),
    ]);
    expect(cov).toEqual({ bodacc: true, sanctions: false });
  });

  it("dossier réel : BODACC en repli fixture (panne) n'est pas couvert", () => {
    const cov = getSourceCoverage([
      live("sirene"),
      fixture("bodacc", "fixture:bodacc(repli)"),
      live("opensanctions"),
    ]);
    expect(cov).toEqual({ bodacc: false, sanctions: true });
  });

  it("dossier réel : un seul contrôle sanctions mené à terme suffit", () => {
    expect(
      getSourceCoverage([live("sirene"), live("bodacc"), live("opensanctions")]).sanctions,
    ).toBe(true);
  });

  it("dossier réel : un contrôle dégradé (HTTP 200 inexploitable) ne compte pas", () => {
    const cov = getSourceCoverage([
      live("sirene"),
      live("bodacc", { endpoint: "https://x (exception)", httpStatus: 0 }),
      live("tresor_gels", { endpoint: "https://x (schéma non reconnu)" }),
      live("opensanctions", { httpStatus: 401 }),
    ]);
    expect(cov).toEqual({ bodacc: false, sanctions: false });
  });
});

describe("computeMitigatingFactors — couverture des contrôles", () => {
  it("sans couverture fournie : comportement historique (aucune régression)", () => {
    const f = ids(computeMitigatingFactors(emptyBundle));
    expect(f).toContain("AUCUNE_ENTITE_SIGNALEE");
    expect(f).toContain("PAS_DE_PROCEDURE");
  });

  it("n'affirme pas « aucune entité signalée » si aucun contrôle sanctions n'a eu lieu", () => {
    const f = ids(
      computeMitigatingFactors(emptyBundle, new Date(), { bodacc: true, sanctions: false }),
    );
    expect(f).not.toContain("AUCUNE_ENTITE_SIGNALEE");
    expect(f).toContain("PAS_DE_PROCEDURE");
  });

  it("n'affirme pas « pas de procédure » si BODACC n'a pas été consulté", () => {
    const f = ids(
      computeMitigatingFactors(emptyBundle, new Date(), { bodacc: false, sanctions: true }),
    );
    expect(f).not.toContain("PAS_DE_PROCEDURE");
    expect(f).toContain("AUCUNE_ENTITE_SIGNALEE");
  });

  it("de bout en bout : dossier réel avec connecteurs désactivés → aucun facteur d'absence", () => {
    const sources = [live("sirene"), fixture("bodacc", "fixture:bodacc(repli)"), fixture("tresor_gels")];
    const f = ids(computeMitigatingFactors(emptyBundle, new Date(), getSourceCoverage(sources)));
    expect(f).not.toContain("AUCUNE_ENTITE_SIGNALEE");
    expect(f).not.toContain("PAS_DE_PROCEDURE");
  });
});
