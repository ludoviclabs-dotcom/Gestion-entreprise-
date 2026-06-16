import type { CaseBundle } from "@/lib/graph/graph-types";
import { countSignalsByFamilySeverity } from "@/lib/graph/graph-types";
import { assembleCase } from "@/lib/ingestion/assemble-case";
import { fixtureCases, fixtureCasesById } from "@/lib/fixtures/cases";
import { seedJournalFor } from "@/lib/audit/fixture-journal";
import {
  buildCreationProofEvents,
  chainNext,
  type ProofEvent,
  type ProofEventKind,
} from "@/lib/audit/journal";
import { payloadHash, sha256 } from "@/lib/audit/hash-chain";
import { fixtureSourceRecordDetails } from "./source-records";
import { journalStore, sessionStore } from "./in-memory-store";
import {
  buildBundleEvidence,
  getScoreStatus,
  getSourceHealth,
} from "./case-quality";
import type {
  CasesRepository,
  CaseSummary,
  CaseDetail,
  CompanyCandidate,
  CaseStatus,
  SourceRecordDetail,
  SourceRow,
} from "./types";

function countHighSignals(bundle: CaseBundle): number {
  return bundle.riskSignals.filter((s) => s.severity === "high").length;
}

function toSummary(
  bundle: CaseBundle,
  status: CaseStatus,
  updatedAt: string,
  sources: SourceRow[] = [],
): CaseSummary {
  const sourceHealth = getSourceHealth(sources);
  return {
    id: bundle.case.id,
    title: bundle.case.title,
    rootSiren: bundle.case.rootSiren,
    status,
    origin: sourceHealth.origin,
    scoreStatus: getScoreStatus(bundle.case.scores ?? {}, status),
    sourceHealth,
    scores: bundle.case.scores ?? {},
    counts: {
      entities: bundle.entities.length,
      edges: bundle.edges.length,
      signalsHigh: countHighSignals(bundle),
    },
    signalsByFamilySeverity: countSignalsByFamilySeverity(bundle.riskSignals),
    lastRunAt: updatedAt,
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
      toSummary(fc.bundle, fc.status, fc.updatedAt, fc.sources),
    );
    const fromSession = sessionStore
      .all()
      .map(([, detail]) =>
        toSummary(detail.bundle, "draft", detail.updatedAt, detail.sources),
      );
    return [...fromSession, ...fromFixtures].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getCase(id: string): Promise<CaseDetail | null> {
    const fixture = fixtureCasesById.get(id);
    if (fixture) {
      return {
        bundle: fixture.bundle,
        sources: fixture.sources,
        evidence: buildBundleEvidence(fixture.bundle, fixture.sources),
      };
    }
    const session = sessionStore.get(id);
    if (session) {
      return {
        bundle: session.bundle,
        sources: session.sources,
        evidence: buildBundleEvidence(session.bundle, session.sources),
      };
    }
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
    sessionStore.set(id, {
      bundle,
      sources,
      evidence: buildBundleEvidence(bundle, sources),
      updatedAt,
      // Payloads bruts conservés pour l'inspecteur de preuve (mode session).
      sourceRecords: sources,
    });
    // Journal de preuve : dossier_cree → source_consultee × N → risque_calcule.
    for (const event of buildCreationProofEvents({
      caseId: id,
      bundle,
      sources,
      occurredAt: updatedAt,
    })) {
      journalStore.append(id, event);
    }
    return toSummary(bundle, "draft", updatedAt, sources);
  }

  async saveSynthesis(
    caseId: string,
    content: string,
    referencedRuleIds?: string[],
  ): Promise<void> {
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
    await this.appendProofEvent(caseId, "synthese_enregistree", {
      longueur: content.length,
      // Empreinte du texte, pas le texte (déjà dans bundle.case.synthesis).
      contenuHash: sha256(content),
      referencedRuleIds: referencedRuleIds ?? [],
    });
  }

  async appendProofEvent(
    caseId: string,
    kind: ProofEventKind,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Tête courante = dernier append runtime, sinon fin du seed fixture.
    const seeded = seedJournalFor(caseId);
    const head =
      journalStore.head(caseId) ?? seeded[seeded.length - 1] ?? null;
    const entry = chainNext(head, {
      caseId,
      kind,
      occurredAt: new Date().toISOString(),
      payload,
    });
    journalStore.append(caseId, entry);
  }

  async listProofEvents(caseId: string): Promise<ProofEvent[]> {
    // Seed de démonstration (dossiers fixtures) ⊕ appends de session.
    return [...seedJournalFor(caseId), ...journalStore.list(caseId)];
  }

  async getSourceRecords(caseId: string): Promise<SourceRecordDetail[]> {
    const fromFixture = fixtureSourceRecordDetails(caseId);
    if (fromFixture.length > 0) return fromFixture;
    const session = sessionStore.get(caseId);
    return (session?.sourceRecords ?? []).map((s) => ({
      source: s.source,
      endpoint: s.endpoint,
      httpStatus: s.httpStatus,
      isFixture: s.isFixture,
      payload: s.raw,
      payloadHash: payloadHash(s.raw),
    }));
  }
}
