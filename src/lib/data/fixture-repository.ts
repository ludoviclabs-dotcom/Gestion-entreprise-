import type { CaseBundle } from "@/lib/graph/graph-types";
import { assembleCase } from "@/lib/ingestion/assemble-case";
import { fixtureCases, fixtureCasesById } from "@/lib/fixtures/cases";
import { sessionStore } from "./in-memory-store";
import type {
  CasesRepository,
  CaseSummary,
  CaseDetail,
  CompanyCandidate,
  CaseStatus,
} from "./types";

function countHighSignals(bundle: CaseBundle): number {
  return bundle.riskSignals.filter((s) => s.severity === "high").length;
}

function toSummary(
  bundle: CaseBundle,
  status: CaseStatus,
  updatedAt: string,
): CaseSummary {
  return {
    id: bundle.case.id,
    title: bundle.case.title,
    rootSiren: bundle.case.rootSiren,
    status,
    scores: bundle.case.scores ?? {},
    counts: {
      entities: bundle.entities.length,
      edges: bundle.edges.length,
      signalsHigh: countHighSignals(bundle),
    },
    updatedAt,
  };
}

/**
 * Implémentation fixtures (+ store mémoire) — la seule de cette passe UI.
 * « Créer un dossier » réutilise l'assembleCase offline existant → marche sans BDD.
 */
export class FixtureCasesRepository implements CasesRepository {
  async listCases(): Promise<CaseSummary[]> {
    const fromFixtures = fixtureCases.map((fc) =>
      toSummary(fc.bundle, fc.status, fc.updatedAt),
    );
    const fromSession = sessionStore
      .all()
      .map(([, detail]) => toSummary(detail.bundle, "draft", detail.updatedAt));
    return [...fromSession, ...fromFixtures].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getCase(id: string): Promise<CaseDetail | null> {
    const fixture = fixtureCasesById.get(id);
    if (fixture) return { bundle: fixture.bundle, sources: fixture.sources };
    const session = sessionStore.get(id);
    if (session) return { bundle: session.bundle, sources: session.sources };
    return null;
  }

  async searchCompanies(q: string): Promise<CompanyCandidate[]> {
    // Réutilise le connecteur Sirene (fixtures via shouldMock() en mode démo).
    const { sirene } = await import("@/lib/connectors/sirene");
    const result = await sirene.search(q);
    type SearchUL = {
      siren?: string;
      periodesUniteLegale?: Array<{
        denominationUniteLegale?: string | null;
        activitePrincipaleUniteLegale?: string | null;
        etatAdministratifUniteLegale?: string | null;
      }>;
    };
    const uls = (result.raw as { unitesLegales?: SearchUL[] }).unitesLegales ?? [];
    return uls
      .map((ul) => {
        const p = ul.periodesUniteLegale?.[0] ?? {};
        return {
          siren: ul.siren ?? "",
          denomination: p.denominationUniteLegale ?? null,
          naf: p.activitePrincipaleUniteLegale ?? null,
          etat: p.etatAdministratifUniteLegale ?? null,
        };
      })
      .filter((c) => c.siren);
  }

  async createCaseFromSiren(siren: string): Promise<CaseSummary> {
    const { bundle, sources } = await assembleCase(siren);
    const id = `s-${siren}-${sessionStore.all().length + 1}`;
    bundle.case.id = id;
    const updatedAt = new Date().toISOString();
    sessionStore.set(id, { bundle, sources, updatedAt });
    return toSummary(bundle, "draft", updatedAt);
  }

  async saveSynthesis(caseId: string, content: string): Promise<void> {
    // Les fixtures statiques sont immuables : seuls les dossiers en session
    // peuvent recevoir une synthèse. Si l'id ne correspond à aucune entrée
    // session-store on lève une erreur explicite (le repository fixtures sert
    // de mode démo offline ; pour persister, basculer en `DbCasesRepository`
    // via `DATABASE_URL`).
    const ok = sessionStore.setSynthesis(caseId, content);
    if (!ok) {
      throw new Error(
        "La synthèse manuelle n'est persistable que pour les dossiers créés en session — branche Neon (`DATABASE_URL`) pour persister sur les fixtures statiques.",
      );
    }
  }
}
