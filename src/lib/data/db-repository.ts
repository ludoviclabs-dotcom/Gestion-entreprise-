import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  cases,
  entities,
  companies,
  persons,
  addresses,
  edges,
  events,
  evidence,
  riskSignals,
  sourceRecords,
  auditLogs,
} from "@/lib/db/schema";
import { assembleCase } from "@/lib/ingestion/assemble-case";
import { countSignalsByFamilySeverity } from "@/lib/graph/graph-types";
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
import { journalStore } from "./in-memory-store";
import { edgeAttributes, readEdgeAttributes } from "./edge-attributes";
import {
  buildBundleEvidence,
  inferEdgeSource,
  inferEntitySource,
  inferEventSource,
  inferSignalSource,
  getScoreStatus,
  getSourceHealth,
} from "./case-quality";
import { SCORE_MODEL_VERSION, scoreModelVersionOf } from "@/lib/risk/engine";
import { timingsOf } from "@/lib/data/timings";
import { pressOf } from "@/lib/data/press-status";
import { planPressCompletion } from "@/lib/data/press-completion";
import { gdelt } from "@/lib/connectors/gdelt";

/** Format UUID (les ids de dossiers réels) — un id non-UUID est une fixture. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import type {
  CaseBundle,
  CaseEdge,
  CaseEntity,
  CaseEvent,
  CaseRiskSignal,
  EdgeKind,
  EvidenceLevel,
  NodeKind,
  RiskCategory,
  Severity,
} from "@/lib/graph/graph-types";
import type {
  CaseDetail,
  CasesRepository,
  CaseStatus,
  CaseSummary,
  CompanyCandidate,
  EvidenceRow,
  SourceRecordDetail,
  SourceRow,
} from "./types";
import type { SourceKind } from "@/lib/graph/source";
import type { SourceRecordInput } from "@/lib/connectors/types";

type EntityAttrs = Record<string, string>;

function toSourceRows(sources: SourceRecordInput[]): SourceRow[] {
  return sources.map((source) => ({
    source: source.source,
    endpoint: source.endpoint,
    httpStatus: source.httpStatus,
    isFixture: source.isFixture,
  }));
}

function sourceRecordIdFor(
  source: SourceKind | null,
  sourceRecordBySource: Map<SourceKind, string>,
): string | null {
  return source ? (sourceRecordBySource.get(source) ?? null) : null;
}

/** Sépare les attributs « réservés » (source, excerpt) du reste du jsonb. */
function splitAttrs(attrs: unknown): {
  clean: EntityAttrs;
  source?: string;
  excerpt?: string;
} {
  const all = (attrs ?? {}) as Record<string, unknown>;
  const clean: EntityAttrs = {};
  let source: string | undefined;
  let excerpt: string | undefined;
  for (const [k, v] of Object.entries(all)) {
    if (k === "__source") source = String(v);
    else if (k === "__excerpt") excerpt = String(v);
    else if (typeof v === "string") clean[k] = v;
  }
  return { clean, source, excerpt };
}

/** Extrait prénoms/nom d'un libellé « Jean MARTIN ». */
function splitPersonName(label: string): { prenoms: string; nom: string } {
  const parts = label.trim().split(/\s+/);
  const idx = parts.findIndex((p) => p.length > 1 && p === p.toUpperCase());
  if (idx <= 0) return { prenoms: "", nom: label };
  return {
    prenoms: parts.slice(0, idx).join(" "),
    nom: parts.slice(idx).join(" "),
  };
}

/**
 * Détecte l'erreur Postgres « relation inexistante » (code 42P01) — typiquement
 * quand une migration n'a pas encore été appliquée à la base. Neon enveloppe
 * l'erreur, on remonte donc la chaîne de `cause`. Sert à dégrader proprement les
 * accès à une table OPTIONNELLE (journal de preuve `audit_logs`, migration 0003)
 * au lieu de faire planter tout le rendu d'un dossier. Toute autre erreur
 * continue d'être propagée (aucun masquage de vrai bug).
 */
function isMissingTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
    const e = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (e.code === "42P01") return true;
    if (
      typeof e.message === "string" &&
      /relation ".*" does not exist/i.test(e.message)
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}

/**
 * Découpe un lot de lignes à insérer (limite de paramètres d'une requête
 * Postgres ≈ 65 535). Renvoie [] pour un lot vide : Drizzle refuse `values([])`.
 */
function chunkRows<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * Implémentation Neon Postgres (Drizzle) du repository.
 * S'active automatiquement dès que `DATABASE_URL` est défini.
 *
 * Notes :
 *  - Pas de transaction INTERACTIVE avec le driver neon-http, mais `db.batch`
 *    exécute plusieurs instructions en UNE requête transactionnelle : la
 *    création d'un dossier est atomique (tout ou rien) et ne coûte qu'un
 *    aller-retour. En cas d'échec, le dossier est marqué `status:'error'`.
 *  - Les champs CaseEntity.source/excerpt sont stockés sous les clés
 *    réservées `__source` / `__excerpt` dans entities.attributes (jsonb).
 */
export class DbCasesRepository implements CasesRepository {
  async listCases(): Promise<CaseSummary[]> {
    const db = getDb();
    const rows = await db.execute(sql`
      SELECT
        c.id, c.title, c.root_siren, c.status,
        c.score_complexite, c.score_vigilance, c.score_qualite_preuve,
        c.updated_at,
        (SELECT COUNT(*)::int FROM entities WHERE case_id = c.id) AS entities_count,
        (SELECT COUNT(*)::int FROM edges    WHERE case_id = c.id) AS edges_count,
        (SELECT COUNT(*)::int FROM risk_signals
           WHERE case_id = c.id AND severity = 'high')            AS high_count,
        (SELECT COUNT(*)::int FROM source_records
           WHERE case_id = c.id)                                  AS sources_count,
        (SELECT COUNT(*)::int FROM source_records
           WHERE case_id = c.id AND is_fixture = 'true')          AS fixture_sources_count,
        (SELECT COUNT(*)::int FROM source_records
           WHERE case_id = c.id
             AND NULLIF(http_status, '')::int >= 400)             AS failed_sources_count
      FROM cases c
      ORDER BY c.updated_at DESC
    `);

    type Row = {
      id: string;
      title: string;
      root_siren: string;
      status: CaseStatus;
      score_complexite: number | null;
      score_vigilance: number | null;
      score_qualite_preuve: number | null;
      updated_at: Date | string;
      entities_count: number | null;
      edges_count: number | null;
      high_count: number | null;
      sources_count: number | null;
      fixture_sources_count: number | null;
      failed_sources_count: number | null;
    };
    const list =
      (rows as unknown as { rows?: Row[] }).rows ?? (rows as unknown as Row[]);

    const dbSummaries: CaseSummary[] = list.map((r) => {
      const scores = {
        complexite: r.score_complexite ?? undefined,
        vigilance: r.score_vigilance ?? undefined,
        qualitePreuve: r.score_qualite_preuve ?? undefined,
      };
      const total = r.sources_count ?? 0;
      const fixture = r.fixture_sources_count ?? 0;
      const sourceHealth = getSourceHealth(
        Array.from({ length: total }, (_, index) => {
          const isFixture = index < fixture;
          return {
            source: isFixture ? ("fixture" as const) : ("manual" as const),
            endpoint: "",
            httpStatus: index < (r.failed_sources_count ?? 0) ? 500 : isFixture ? 0 : 200,
            isFixture,
          };
        }),
      );
      const updatedAt =
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : new Date(r.updated_at).toISOString();
      return {
        id: r.id,
        title: r.title,
        rootSiren: r.root_siren,
        status: r.status,
        origin: sourceHealth.origin,
        scoreStatus: getScoreStatus(scores, r.status),
        sourceHealth,
        scores,
        counts: {
          entities: r.entities_count ?? 0,
          edges: r.edges_count ?? 0,
          signalsHigh: r.high_count ?? 0,
        },
        lastRunAt: updatedAt,
        updatedAt,
      };
    });

    // Fusionne les dossiers de DÉMONSTRATION (fixtures) — `getCase` les sert déjà
    // par leur slug (id non-UUID), on les expose donc aussi dans la liste, SANS
    // rien écrire en base. Dédoublonnage par SIREN : un vrai dossier en base
    // masque la fixture de même SIREN (évite un doublon réel/démo, ex. DANONE).
    const dbSirens = new Set(dbSummaries.map((s) => s.rootSiren));
    const fixtureSummaries: CaseSummary[] = fixtureCases
      .filter((fc) => !dbSirens.has(fc.bundle.case.rootSiren))
      .map((fc) => {
        const sourceHealth = getSourceHealth(fc.sources);
        const scores = fc.bundle.case.scores ?? {};
        return {
          id: fc.bundle.case.id,
          title: fc.bundle.case.title,
          rootSiren: fc.bundle.case.rootSiren,
          status: fc.status,
          origin: sourceHealth.origin,
          scoreStatus: getScoreStatus(scores, fc.status),
          sourceHealth,
          scores,
          counts: {
            entities: fc.bundle.entities.length,
            edges: fc.bundle.edges.length,
            signalsHigh: fc.bundle.riskSignals.filter((s) => s.severity === "high")
              .length,
          },
          signalsByFamilySeverity: countSignalsByFamilySeverity(
            fc.bundle.riskSignals,
          ),
          lastRunAt: fc.updatedAt,
          updatedAt: fc.updatedAt,
        };
      });

    return [...dbSummaries, ...fixtureSummaries].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getCase(id: string): Promise<CaseDetail | null> {
    // Les dossiers réels portent un UUID ; un id non-UUID ne peut être qu'une
    // fixture de démonstration (slug). On court-circuite alors la requête DB —
    // ce qui évite l'erreur Postgres « invalid input syntax for type uuid » et
    // sert le dossier de démo en lecture seule (marqué « Démonstration » côté UI).
    if (!UUID_RE.test(id)) {
      const fx = fixtureCasesById.get(id);
      return fx
        ? {
            bundle: fx.bundle,
            sources: fx.sources,
            evidence: buildBundleEvidence(fx.bundle, fx.sources),
          }
        : null;
    }
    const db = getDb();
    const [caseRow] = await db.select().from(cases).where(eq(cases.id, id));
    if (!caseRow) {
      const fx = fixtureCasesById.get(id);
      return fx
        ? {
            bundle: fx.bundle,
            sources: fx.sources,
            evidence: buildBundleEvidence(fx.bundle, fx.sources),
          }
        : null;
    }

    const [entRows, edgeRows, evtRows, sigRows, srcRows] = await Promise.all([
      db.select().from(entities).where(eq(entities.caseId, id)),
      db.select().from(edges).where(eq(edges.caseId, id)),
      db.select().from(events).where(eq(events.caseId, id)),
      db.select().from(riskSignals).where(eq(riskSignals.caseId, id)),
      db.select().from(sourceRecords).where(eq(sourceRecords.caseId, id)),
    ]);

    const bundleEntities: CaseEntity[] = entRows.map((e) => {
      const { clean, source, excerpt } = splitAttrs(e.attributes);
      return {
        id: e.id,
        type: e.type as NodeKind,
        label: e.label,
        evidenceLevel: e.evidenceLevel as EvidenceLevel,
        attributes: clean,
        source,
        excerpt,
      };
    });

    const bundleEdges: CaseEdge[] = edgeRows.map((e) => {
      const attrs = readEdgeAttributes(e.attributes);
      return {
        id: e.id,
        type: e.type as EdgeKind,
        source: e.sourceId,
        target: e.targetId,
        label: attrs.label,
        weight: e.weight ?? undefined,
        votingWeight: attrs.votingWeight,
        specialRights: attrs.specialRights,
        evidenceLevel: e.evidenceLevel as EvidenceLevel,
        excerpt: attrs.excerpt,
        validFrom: e.validFrom ?? undefined,
        validTo: e.validTo ?? undefined,
      };
    });

    const bundleEvents: CaseEvent[] = evtRows.map((e) => {
      const payload = (e.payload ?? {}) as { source?: string };
      return {
        id: e.id,
        entityId: e.entityId ?? "",
        kind: e.kind,
        title: e.title,
        occurredOn: e.occurredOn ?? undefined,
        evidenceLevel: e.evidenceLevel as EvidenceLevel,
        source: payload.source,
      };
    });

    const bundleSignals: CaseRiskSignal[] = sigRows.map((s) => ({
      id: s.id,
      ruleId: s.ruleId,
      subjectId: s.subjectId ?? undefined,
      severity: s.severity as Severity,
      category: s.category as RiskCategory,
      explanation: s.explanation,
    }));

    const sources: SourceRow[] = srcRows.map((s) => ({
      source: s.source as SourceRow["source"],
      endpoint: s.endpoint,
      httpStatus: Number(s.httpStatus ?? 0),
      isFixture: s.isFixture === "true",
    }));

    type EvidenceDbRow = {
      subject_type: EvidenceRow["subjectType"];
      subject_id: string;
      source_record_id: string | null;
      level: EvidenceLevel;
      excerpt: string | null;
      pointer: Record<string, unknown> | null;
      source: SourceRow["source"] | null;
    };
    // Requête de preuve isolée et tolérante : le graphe et les autres onglets
    // n'en dépendent pas. En cas d'échec (dérive de schéma, jointure, etc.), on
    // retombe sur la preuve dérivée du bundle (buildBundleEvidence) au lieu de
    // faire planter tout le rendu du dossier.
    let evidenceRows: EvidenceRow[] = [];
    try {
      const evdRowsRaw = await db.execute(sql`
        SELECT
          e.subject_type,
          e.subject_id::text,
          e.source_record_id::text,
          e.level,
          e.excerpt,
          e.pointer,
          sr.source
        FROM evidence e
        LEFT JOIN source_records sr ON sr.id = e.source_record_id
        WHERE e.case_id = ${id}
      `);
      const evidenceList =
        (evdRowsRaw as unknown as { rows?: EvidenceDbRow[] }).rows ??
        (evdRowsRaw as unknown as EvidenceDbRow[]);
      evidenceRows = evidenceList.map((e) => ({
        subjectType: e.subject_type,
        subjectId: e.subject_id,
        source: e.source,
        sourceRecordId: e.source_record_id ?? undefined,
        level: e.level,
        excerpt: e.excerpt ?? undefined,
        pointer: e.pointer ?? undefined,
      }));
    } catch (error) {
      console.error(
        `[getCase] requête evidence en échec pour le dossier ${id} — repli sur la preuve dérivée`,
        error,
      );
    }

    const bundle: CaseBundle = {
      case: {
        id: caseRow.id,
        title: caseRow.title,
        rootSiren: caseRow.rootSiren,
        scores: {
          complexite: caseRow.scoreComplexite ?? undefined,
          vigilance: caseRow.scoreVigilance ?? undefined,
          qualitePreuve: caseRow.scoreQualitePreuve ?? undefined,
        },
        synthesis: caseRow.synthesisContent
          ? {
              content: caseRow.synthesisContent,
              updatedAt:
                caseRow.synthesisUpdatedAt instanceof Date
                  ? caseRow.synthesisUpdatedAt.toISOString()
                  : new Date(
                      caseRow.synthesisUpdatedAt ?? Date.now(),
                    ).toISOString(),
            }
          : undefined,
      },
      entities: bundleEntities,
      edges: bundleEdges,
      events: bundleEvents,
      riskSignals: bundleSignals,
    };

    return {
      bundle,
      sources,
      evidence:
        evidenceRows.length > 0
          ? evidenceRows
          : buildBundleEvidence(bundle, sources),
      // Les scores ci-dessus sont ceux de la base : on conserve la version du
      // modèle qui les a produits (jamais l'actuelle par défaut).
      scoreModelVersion: scoreModelVersionOf(caseRow.metadata),
      timings: timingsOf(caseRow.metadata),
      press: pressOf(caseRow.metadata),
    };
  }

  async searchCompanies(q: string): Promise<CompanyCandidate[]> {
    // Réutilise le connecteur Sirene (live si clé, fixtures sinon).
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
    const db = getDb();
    // La presse (GDELT, 10 à 15 s) n'est pas attendue : collectée après la réponse
    // (`completePendingPress`), le dossier est servi sans elle en attendant.
    const {
      bundle,
      sources,
      timings = {},
      pressDeferred = false,
    } = await assembleCase(siren, { deferPress: true });
    const press = pressDeferred
      ? { state: "pending" as const, requestedAt: new Date().toISOString() }
      : undefined;
    // Une ligne par dossier dans les journaux serveur : repérer la source lente.
    console.info(
      "[case-timing]",
      JSON.stringify({ siren, totalMs: timings._total, ...timings }),
    );
    const sourceRows = toSourceRows(sources);
    const sourceHealth = getSourceHealth(sourceRows);
    const scores = bundle.case.scores ?? {};

    // 1. Case — on persiste aussi les scores calculés par computeRisk dans
    // assembleCase (sinon Complexité/Vigilance/Qualité de preuve restent '—').
    const [caseRow] = await db
      .insert(cases)
      .values({
        title: bundle.case.title,
        rootSiren: siren,
        status: "draft",
        scoreComplexite: bundle.case.scores?.complexite ?? null,
        scoreVigilance: bundle.case.scores?.vigilance ?? null,
        scoreQualitePreuve: bundle.case.scores?.qualitePreuve ?? null,
        metadata: {
          scoreModelVersion: SCORE_MODEL_VERSION,
          origin: sourceHealth.origin,
          sourceHealth,
          scoreStatus: getScoreStatus(scores, "draft"),
          ...(press ? { press } : {}),
        },
      })
      .returning();
    const caseId = caseRow.id;

    try {
      // PERFORMANCE : la version précédente faisait ~300 INSERT successifs (un
      // aller-retour HTTPS Neon chacun, ≈ 55 s pour un dossier de 40 entités).
      // Les identifiants sont désormais générés ICI et toutes les lignes partent
      // en UNE requête transactionnelle (`db.batch`) : tout ou rien, une seule
      // latence réseau. Si une écriture échoue, rien n'est persisté et le dossier
      // est marqué « error » (catch plus bas).
      const completedAt = new Date();

      // 1. Source records (chaîne de preuve) — ids pré-générés pour que evidence
      // puisse les référencer sans attendre un `returning()`.
      const sourceRecordBySource = new Map<SourceKind, string>();
      const sourceRecordRows = sources.map((src) => {
        const id = randomUUID();
        if (!sourceRecordBySource.has(src.source)) {
          sourceRecordBySource.set(src.source, id);
        }
        return {
          id,
          caseId,
          source: src.source,
          endpoint: src.endpoint,
          httpStatus: String(src.httpStatus),
          payload: src.raw,
          // Convention historique source_records (JSON.stringify verbatim).
          payloadHash: payloadHash(src.raw),
          isFixture: src.isFixture ? "true" : "false",
        };
      });

      type EntityInsert = typeof entities.$inferInsert;
      type CompanyInsert = typeof companies.$inferInsert;
      type PersonInsert = typeof persons.$inferInsert;
      type AddressInsert = typeof addresses.$inferInsert;
      type EdgeInsert = typeof edges.$inferInsert;
      type EventInsert = typeof events.$inferInsert;
      type SignalInsert = typeof riskSignals.$inferInsert;
      type EvidenceInsert = typeof evidence.$inferInsert;

      const entityRows: EntityInsert[] = [];
      const companyRows: CompanyInsert[] = [];
      const personRows: PersonInsert[] = [];
      const addressRows: AddressInsert[] = [];
      const edgeRows: EdgeInsert[] = [];
      const eventRows: EventInsert[] = [];
      const signalRows: SignalInsert[] = [];
      const evidenceRows: EvidenceInsert[] = [];

      // 2. Entities + sous-tables (map fixture-id → uuid pour edges/events/signaux)
      const idMap = new Map<string, string>();
      for (const ent of bundle.entities) {
        const entityId = randomUUID();
        idMap.set(ent.id, entityId);
        const mergedAttrs: Record<string, string> = { ...(ent.attributes ?? {}) };
        if (ent.source) mergedAttrs.__source = ent.source;
        if (ent.excerpt) mergedAttrs.__excerpt = ent.excerpt;

        entityRows.push({
          id: entityId,
          caseId,
          type: ent.type,
          label: ent.label,
          evidenceLevel: ent.evidenceLevel,
          naturalKey: ent.id,
          attributes: mergedAttrs,
        });
        evidenceRows.push({
          caseId,
          subjectType: "entity",
          subjectId: entityId,
          sourceRecordId: sourceRecordIdFor(
            inferEntitySource(ent),
            sourceRecordBySource,
          ),
          level: ent.evidenceLevel,
          excerpt: ent.excerpt ?? ent.source ?? null,
          pointer: { naturalKey: ent.id, type: ent.type },
        });

        if (ent.type === "company") {
          const a = ent.attributes ?? {};
          companyRows.push({
            entityId,
            // Le SIREN racine ne sert de repli QUE pour la société sujet : une
            // société sans SIREN propre (ex. mère étrangère GLEIF, LEI seul) ne
            // doit pas hériter du SIREN racine (corromprait la recherche). On
            // retombe alors sur son LEI, sinon l'identifiant du nœud.
            siren:
              (a["SIREN"] ?? "").replace(/\s/g, "") ||
              (ent.id === `co:${siren}` ? siren : (a["LEI"] ?? entityId)),
            denomination: ent.label,
            formeJuridique: a["Forme juridique"] ?? null,
            nafCode: a["Activité (NAF)"]?.split(/\s|—/)[0] ?? null,
            nafLabel: a["Activité (NAF)"] ?? null,
            etatAdministratif: a["État"] ?? null,
          });
        } else if (ent.type === "person") {
          const { prenoms, nom } = splitPersonName(ent.label);
          const a = ent.attributes ?? {};
          personRows.push({
            entityId,
            nom,
            prenoms,
            qualite: a["Qualité"] ?? null,
            nationalite: a["Nationalité"] ?? null,
          });
        } else if (ent.type === "address") {
          const a = ent.attributes ?? {};
          addressRows.push({
            entityId,
            ligne: ent.label,
            codePostal: a["Code postal"] ?? null,
            commune: a["Commune"] ?? null,
            pays: a["Pays"] ?? "France",
            normalized: ent.label.toLowerCase(),
          });
        }
      }

      // 3. Edges
      for (const edge of bundle.edges) {
        const src = idMap.get(edge.source);
        const tgt = idMap.get(edge.target);
        if (!src || !tgt) continue;
        const edgeId = randomUUID();
        edgeRows.push({
          id: edgeId,
          caseId,
          type: edge.type,
          sourceId: src,
          targetId: tgt,
          evidenceLevel: edge.evidenceLevel,
          weight: edge.weight ?? null,
          validFrom: edge.validFrom ?? null,
          validTo: edge.validTo ?? null,
          attributes: edgeAttributes(edge),
        });
        evidenceRows.push({
          caseId,
          subjectType: "edge",
          subjectId: edgeId,
          sourceRecordId: sourceRecordIdFor(
            inferEdgeSource(edge, bundle),
            sourceRecordBySource,
          ),
          level: edge.evidenceLevel,
          excerpt: edge.excerpt ?? edge.label ?? null,
          pointer: {
            naturalKey: edge.id,
            edgeType: edge.type,
            sourceNaturalKey: edge.source,
            targetNaturalKey: edge.target,
          },
        });
      }

      // 4. Events
      for (const ev of bundle.events) {
        const subj = idMap.get(ev.entityId);
        if (!subj) continue;
        const eventSource = inferEventSource(ev) ?? "bodacc";
        const eventId = randomUUID();
        eventRows.push({
          id: eventId,
          caseId,
          entityId: subj,
          kind: ev.kind,
          source: eventSource,
          occurredOn: ev.occurredOn ?? null,
          title: ev.title,
          evidenceLevel: ev.evidenceLevel,
          payload: { source: ev.source },
        });
        evidenceRows.push({
          caseId,
          subjectType: "event",
          subjectId: eventId,
          sourceRecordId: sourceRecordIdFor(eventSource, sourceRecordBySource),
          level: ev.evidenceLevel,
          excerpt: ev.title,
          pointer: { naturalKey: ev.id, kind: ev.kind },
        });
      }

      // 5. Risk signals
      for (const sig of bundle.riskSignals) {
        const subj = sig.subjectId ? (idMap.get(sig.subjectId) ?? null) : null;
        const signalId = randomUUID();
        signalRows.push({
          id: signalId,
          caseId,
          ruleId: sig.ruleId,
          subjectType: "entity",
          subjectId: subj,
          severity: sig.severity,
          category: sig.category,
          explanation: sig.explanation,
        });
        evidenceRows.push({
          caseId,
          subjectType: "risk_signal",
          subjectId: signalId,
          sourceRecordId: sourceRecordIdFor(
            inferSignalSource(sig, bundle),
            sourceRecordBySource,
          ),
          level: "inferred",
          excerpt: sig.explanation,
          pointer: { naturalKey: sig.id, ruleId: sig.ruleId },
        });
      }

      // 6. Écriture en UNE requête transactionnelle. L'ordre respecte les clés
      // étrangères (source_records → entities → sous-tables / liens / événements /
      // signaux → evidence) ; le passage à « prêt » est la DERNIÈRE instruction.
      // Les lots sont découpés (limite de paramètres Postgres), jamais vides
      // (Drizzle refuse `values([])`).
      const batch = [
        ...chunkRows(sourceRecordRows).map((r) => db.insert(sourceRecords).values(r)),
        ...chunkRows(entityRows).map((r) => db.insert(entities).values(r)),
        ...chunkRows(companyRows).map((r) => db.insert(companies).values(r)),
        ...chunkRows(personRows).map((r) => db.insert(persons).values(r)),
        ...chunkRows(addressRows).map((r) => db.insert(addresses).values(r)),
        ...chunkRows(edgeRows).map((r) => db.insert(edges).values(r)),
        ...chunkRows(eventRows).map((r) => db.insert(events).values(r)),
        ...chunkRows(signalRows).map((r) => db.insert(riskSignals).values(r)),
        ...chunkRows(evidenceRows).map((r) => db.insert(evidence).values(r)),
        db
          .update(cases)
          .set({
            status: "ready",
            updatedAt: completedAt,
            metadata: {
              scoreModelVersion: SCORE_MODEL_VERSION,
              origin: sourceHealth.origin,
              sourceHealth,
              scoreStatus: getScoreStatus(scores, "ready"),
              lastRunAt: completedAt.toISOString(),
              timings,
              ...(press ? { press } : {}),
            },
          })
          .where(eq(cases.id, caseId)),
      ];
      await db.batch(batch as unknown as Parameters<typeof db.batch>[0]);

      // 8. Journal de preuve (audit_logs) : la séquence de création chaînée.
      // Tolérant : si la table audit_logs n'a pas encore été migrée (0003), on
      // n'échoue PAS la création — le dossier reste « prêt », le journal est
      // simplement non écrit (et signalé en logs).
      const proofEvents = buildCreationProofEvents({
        caseId,
        bundle,
        sources,
        occurredAt: completedAt.toISOString(),
      });
      try {
        await db.insert(auditLogs).values(
          proofEvents.map((event) => ({
            caseId,
            seq: event.seq,
            kind: event.kind,
            payload: event.payload,
            occurredAt: event.occurredAt,
            prevHash: event.prevHash,
            entryHash: event.entryHash,
          })),
        );
      } catch (error) {
        if (!isMissingTableError(error)) throw error;
        console.warn(
          `[createCaseFromSiren] table audit_logs absente — journal de preuve non écrit pour ${caseId}. Appliquer la migration 0003 (npm run db:migrate).`,
        );
      }

      return {
        id: caseId,
        title: bundle.case.title,
        rootSiren: siren,
        status: "ready",
        origin: sourceHealth.origin,
        scoreStatus: getScoreStatus(scores, "ready"),
        sourceHealth,
        scores,
        counts: {
          entities: bundle.entities.length,
          edges: bundle.edges.length,
          signalsHigh: bundle.riskSignals.filter((s) => s.severity === "high")
            .length,
        },
        signalsByFamilySeverity: countSignalsByFamilySeverity(
          bundle.riskSignals,
        ),
        lastRunAt: completedAt.toISOString(),
        updatedAt: completedAt.toISOString(),
      };
    } catch (error) {
      // Marque le dossier en erreur, ne masque pas l'exception.
      await db
        .update(cases)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(cases.id, caseId));
      throw error;
    }
  }

  async completePendingPress(caseId: string): Promise<void> {
    if (!UUID_RE.test(caseId)) return;
    const db = getDb();
    let requestedAt: string | undefined;
    try {
      const [row] = await db.select().from(cases).where(eq(cases.id, caseId));
      const status = pressOf(row?.metadata);
      if (!row || status?.state !== "pending") return;
      requestedAt = status.requestedAt;

      const startedAt = Date.now();
      // Même libellé que celui utilisé à la création (dénomination du sujet).
      const result = await gdelt.byName(row.title);
      const elapsed = Date.now() - startedAt;

      const detail = await this.getCase(caseId);
      if (!detail) return;
      // Sujet = la société portant le SIREN racine (id persistant, pas la clé
      // naturelle : l'identité canonique peut différer après résolution).
      const [subject] = await db
        .select({ id: entities.id })
        .from(entities)
        .innerJoin(companies, eq(companies.entityId, entities.id))
        .where(and(eq(entities.caseId, caseId), eq(companies.siren, row.rootSiren)))
        .limit(1);
      const subjectId =
        subject?.id ??
        detail.bundle.entities.find((e) => e.type === "company")?.id;
      if (!subjectId) throw new Error("sujet introuvable");

      const plan = planPressCompletion({
        caseId,
        bundle: detail.bundle,
        sources: detail.sources,
        gdelt: result,
        subjectId,
      });
      const completedAt = new Date();
      const previous = (row.metadata ?? {}) as Record<string, unknown>;
      const metadata = {
        ...previous,
        origin: plan.sourceHealth.origin,
        sourceHealth: plan.sourceHealth,
        scoreStatus: getScoreStatus(plan.scores, "ready"),
        timings: { ...(timingsOf(previous) ?? {}), gdelt: elapsed },
        press: {
          state: "done",
          requestedAt,
          completedAt: completedAt.toISOString(),
        },
      };

      // UNE requête transactionnelle : la presse, ses événements, leur preuve, le
      // signal éventuel et les scores apparaissent ensemble — jamais à moitié.
      const batch = [
        db.insert(sourceRecords).values(plan.sourceRecord),
        ...chunkRows(plan.eventRows).map((r) => db.insert(events).values(r)),
        ...chunkRows(plan.signalRows).map((r) => db.insert(riskSignals).values(r)),
        ...chunkRows(plan.evidenceRows).map((r) => db.insert(evidence).values(r)),
        db
          .update(cases)
          .set({
            scoreVigilance: plan.scores.vigilance ?? null,
            scoreQualitePreuve: plan.scores.qualitePreuve ?? null,
            updatedAt: completedAt,
            metadata,
          })
          .where(eq(cases.id, caseId)),
      ];
      await db.batch(batch as unknown as Parameters<typeof db.batch>[0]);

      // Journal de preuve : la consultation et le recalcul complémentaire.
      try {
        await this.appendProofEvent(caseId, "source_consultee", {
          source: "gdelt",
          endpoint: plan.sourceRecord.endpoint,
          httpStatus: result.httpStatus,
          isFixture: result.isFixture,
          payloadHash: plan.sourceRecord.payloadHash,
          collecteApresCreation: true,
        });
        await this.appendProofEvent(caseId, "risque_calcule", {
          reglesDeclenchees: [
            ...new Set(
              [...detail.bundle.riskSignals, ...plan.signals].map((s) => s.ruleId),
            ),
          ],
          scores: plan.scores,
          scoreModelVersion: scoreModelVersionOf(previous),
          complement: "presse",
        });
      } catch (error) {
        console.warn("[completePendingPress] journal de preuve non écrit", error);
      }
      console.info(
        "[press-timing]",
        JSON.stringify({ caseId, gdeltMs: elapsed, usable: plan.usable }),
      );
    } catch (error) {
      // Ne lève jamais (appelé après la réponse). Dossier conservé tel quel ;
      // l'état « interrompue » est signalé, la presse reste « non interrogée ».
      console.error("[completePendingPress] échec", error);
      try {
        await db
          .update(cases)
          .set({
            metadata: sql`jsonb_set(coalesce(metadata, '{}'::jsonb), '{press}', ${JSON.stringify({
              state: "failed",
              requestedAt,
              completedAt: new Date().toISOString(),
            })}::jsonb)`,
          })
          .where(eq(cases.id, caseId));
      } catch {
        // Best effort.
      }
    }
  }

  async saveSynthesis(
    caseId: string,
    content: string,
    referencedRuleIds?: string[],
  ): Promise<void> {
    const db = getDb();
    const now = new Date();
    await db
      .update(cases)
      .set({
        synthesisContent: content,
        synthesisUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(cases.id, caseId));
    await this.appendProofEvent(caseId, "synthese_enregistree", {
      longueur: content.length,
      // Empreinte du texte, pas le texte (déjà dans cases.synthesis_content).
      contenuHash: sha256(content),
      referencedRuleIds: referencedRuleIds ?? [],
    });
  }

  async appendProofEvent(
    caseId: string,
    kind: ProofEventKind,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // Fixture servie en mode BDD (id non-UUID) → jumeau mémoire, comme getCase.
    if (!UUID_RE.test(caseId)) {
      const seeded = seedJournalFor(caseId);
      const head =
        journalStore.head(caseId) ?? seeded[seeded.length - 1] ?? null;
      journalStore.append(
        caseId,
        chainNext(head, {
          caseId,
          kind,
          occurredAt: new Date().toISOString(),
          payload,
        }),
      );
      return;
    }

    const db = getDb();
    // Deux tentatives : en cas de course sur seq (pas de transaction
    // interactive avec neon-http), l'index unique (case_id, seq) rejette le
    // doublon et on rechaîne depuis la nouvelle tête. Mono-tenant : suffisant.
    // Tolérant à l'absence de table audit_logs (migration 0003 non appliquée) :
    // on n'écrit alors pas le journal plutôt que de planter le flux appelant.
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const [head] = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.caseId, caseId))
          .orderBy(desc(auditLogs.seq))
          .limit(1);
        const entry = chainNext(head ? rowToProofEvent(head) : null, {
          caseId,
          kind,
          occurredAt: new Date().toISOString(),
          payload,
        });
        try {
          await db.insert(auditLogs).values({
            caseId,
            seq: entry.seq,
            kind: entry.kind,
            payload: entry.payload,
            occurredAt: entry.occurredAt,
            prevHash: entry.prevHash,
            entryHash: entry.entryHash,
          });
          return;
        } catch (error) {
          if (isMissingTableError(error)) throw error; // → catch externe
          if (attempt === 1) throw error;
        }
      }
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      console.warn(
        `[appendProofEvent] table audit_logs absente — événement « ${kind} » non journalisé pour ${caseId}. Appliquer la migration 0003 (npm run db:migrate).`,
      );
    }
  }

  async listProofEvents(caseId: string): Promise<ProofEvent[]> {
    if (!UUID_RE.test(caseId)) {
      return [...seedJournalFor(caseId), ...journalStore.list(caseId)];
    }
    const db = getDb();
    // Tolérant à l'absence de table audit_logs (migration 0003 non appliquée) :
    // journal vide plutôt que crash de l'onglet Sources/Risques et de l'export.
    try {
      const rows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.caseId, caseId))
        .orderBy(asc(auditLogs.seq));
      return rows.map(rowToProofEvent);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      console.warn(
        `[listProofEvents] table audit_logs absente — journal vide pour ${caseId}. Appliquer la migration 0003 (npm run db:migrate).`,
      );
      return [];
    }
  }

  async getSourceRecords(caseId: string): Promise<SourceRecordDetail[]> {
    // Fixture servie en mode BDD (id non-UUID) → payloads d'exemple.
    if (!UUID_RE.test(caseId)) return fixtureSourceRecordDetails(caseId);
    const db = getDb();
    const rows = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.caseId, caseId))
      .orderBy(asc(sourceRecords.requestedAt));
    return rows.map((r) => ({
      id: r.id,
      source: r.source as SourceRow["source"],
      endpoint: r.endpoint,
      httpStatus: Number(r.httpStatus ?? 0),
      isFixture: r.isFixture === "true",
      payload: r.payload,
      payloadHash: r.payloadHash,
      requestedAt: r.requestedAt.toISOString(),
    }));
  }
}

/** Ligne audit_logs → ProofEvent (occurred_at est déjà l'ISO haché verbatim). */
function rowToProofEvent(row: typeof auditLogs.$inferSelect): ProofEvent {
  return {
    id: row.id,
    caseId: row.caseId,
    seq: row.seq,
    kind: row.kind as ProofEventKind,
    occurredAt: row.occurredAt,
    payload: row.payload ?? {},
    prevHash: row.prevHash,
    entryHash: row.entryHash,
  };
}
