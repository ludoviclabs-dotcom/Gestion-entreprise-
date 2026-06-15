import type { CaseBundle } from "@/lib/graph/graph-types";
import type { CaseStatus, SourceRow } from "@/lib/data/types";
import type { SourceKind } from "@/lib/graph/source";
import { demoBundle } from "@/lib/fixtures/case-demo";
import { cleanCompanyBundle } from "./clean-company";
import { procedureCollectiveBundle } from "./procedure-collective";
import { reseauMultiDirigeantsBundle } from "./reseau-multi-dirigeants";
import { holdingUboBundle } from "./holding-ubo";
import { brouillonBundle } from "./brouillon";
import { materializeCase } from "@/lib/fixtures/materialize";

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

/**
 * Catalogue des dossiers de démonstration (ordre d'affichage).
 *
 * Les dossiers « ready » sont passés par `materializeCase` : scores ET signaux
 * RECALCULÉS de leur graphe (mêmes calculs que le chemin live `assembleCase`) —
 * aucune valeur en dur affichée (cf. docs/audit-calculs.md). Le brouillon reste
 * sans scores : un dossier non enrichi n'a pas de score (honnête).
 */
export const fixtureCases: FixtureCase[] = [
  {
    bundle: materializeCase(demoBundle),
    status: "ready",
    updatedAt: "2026-05-28T10:15:00.000Z",
    sources: demoSources("sirene", "bodacc", "inpi", "tresor_gels"),
  },
  {
    bundle: materializeCase(reseauMultiDirigeantsBundle),
    status: "ready",
    updatedAt: "2026-05-30T16:42:00.000Z",
    sources: demoSources("sirene", "inpi", "bodacc"),
  },
  {
    bundle: materializeCase(holdingUboBundle),
    status: "ready",
    updatedAt: "2026-06-02T11:20:00.000Z",
    sources: demoSources("sirene", "inpi"),
  },
  {
    bundle: materializeCase(procedureCollectiveBundle),
    status: "ready",
    updatedAt: "2026-05-31T09:05:00.000Z",
    sources: demoSources("sirene", "bodacc", "inpi"),
  },
  {
    bundle: materializeCase(cleanCompanyBundle),
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
