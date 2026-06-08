import type { CaseBundle } from "@/lib/graph/graph-types";
import type { CaseStatus, SourceRow } from "@/lib/data/types";
import type { SourceKind } from "@/lib/graph/source";
import { demoBundle } from "@/lib/fixtures/case-demo";
import { cleanCompanyBundle } from "./clean-company";
import { procedureCollectiveBundle } from "./procedure-collective";
import { reseauMultiDirigeantsBundle } from "./reseau-multi-dirigeants";
import { holdingUboBundle } from "./holding-ubo";
import { brouillonBundle } from "./brouillon";

export type FixtureCase = {
  bundle: CaseBundle;
  status: CaseStatus;
  updatedAt: string; // ISO
  sources: SourceRow[];
};

// Trail de provenance type pour un dossier de démonstration (déclaré comme fixture).
function demoSources(...kinds: SourceKind[]): SourceRow[] {
  return kinds.map((source) => ({
    source,
    endpoint: `fixture:${source}`,
    httpStatus: 0,
    isFixture: true,
  }));
}

/** Catalogue des dossiers de démonstration (ordre d'affichage). */
export const fixtureCases: FixtureCase[] = [
  {
    bundle: demoBundle,
    status: "ready",
    updatedAt: "2026-05-28T10:15:00.000Z",
    sources: demoSources("sirene", "bodacc", "inpi", "tresor_gels"),
  },
  {
    bundle: reseauMultiDirigeantsBundle,
    status: "ready",
    updatedAt: "2026-05-30T16:42:00.000Z",
    sources: demoSources("sirene", "inpi", "bodacc"),
  },
  {
    bundle: holdingUboBundle,
    status: "ready",
    updatedAt: "2026-06-02T11:20:00.000Z",
    sources: demoSources("sirene", "inpi"),
  },
  {
    bundle: procedureCollectiveBundle,
    status: "ready",
    updatedAt: "2026-05-31T09:05:00.000Z",
    sources: demoSources("sirene", "bodacc", "inpi"),
  },
  {
    bundle: cleanCompanyBundle,
    status: "ready",
    updatedAt: "2026-05-22T14:30:00.000Z",
    sources: demoSources("sirene", "inpi"),
  },
  {
    bundle: brouillonBundle,
    status: "draft",
    updatedAt: "2026-06-01T08:00:00.000Z",
    sources: demoSources("sirene"),
  },
];

/** Index O(1) par id de dossier. */
export const fixtureCasesById = new Map<string, FixtureCase>(
  fixtureCases.map((fc) => [fc.bundle.case.id, fc]),
);
