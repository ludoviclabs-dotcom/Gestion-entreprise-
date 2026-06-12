import { asc, desc, eq, sql } from "drizzle-orm";
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
import { fixtureCasesById } from "@/lib/fixtures/cases";
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
import {
  buildBundleEvidence,
  inferEdgeSource,
  inferEntitySource,
  inferEventSource,
  inferSignalSource,
  getScoreStatus,
  getSourceHealth,
} from "./case-quality";
import { SCORE_MODEL_VERSION } from "@/lib/risk/engine";

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
 * Implémentation Neon Postgres (Drizzle) du repository.
 * S'active automatiquement dès que `DATABASE_URL` est défini.
 *
 * Notes :
 *  - Pas de transaction interactive avec le driver neon-http. La création
 *    d'un dossier est rendue idempotente par l'index unique (caseId,type,
 *    naturalKey) sur entities ; en cas d'erreur partielle, le dossier reste
 *    en `status:'error'` (pas de rollback).
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

    return list.map((r) => {
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

    const [entRows, edgeRows, evtRows, sigRows, srcRows, evdRowsRaw] =
      await Promise.all([
      db.select().from(entities).where(eq(entities.caseId, id)),
      db.select().from(edges).where(eq(edges.caseId, id)),
      db.select().from(events).where(eq(events.caseId, id)),
      db.select().from(riskSignals).where(eq(riskSignals.caseId, id)),
      db.select().from(sourceRecords).where(eq(sourceRecords.caseId, id)),
      db.execute(sql`
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
      `),
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
      const attrs = (e.attributes ?? {}) as { label?: string; excerpt?: string };
      return {
        id: e.id,
        type: e.type as EdgeKind,
        source: e.sourceId,
        target: e.targetId,
        label: attrs.label,
        weight: e.weight ?? undefined,
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
    const evidenceList =
      (evdRowsRaw as unknown as { rows?: EvidenceDbRow[] }).rows ??
      (evdRowsRaw as unknown as EvidenceDbRow[]);
    const evidenceRows: EvidenceRow[] = evidenceList.map((e) => ({
      subjectType: e.subject_type,
      subjectId: e.subject_id,
      source: e.source,
      sourceRecordId: e.source_record_id ?? undefined,
      level: e.level,
      excerpt: e.excerpt ?? undefined,
      pointer: e.pointer ?? undefined,
    }));

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
    const { bundle, sources } = await assembleCase(siren);
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
        },
      })
      .returning();
    const caseId = caseRow.id;

    try {
      const sourceRecordBySource = new Map<SourceKind, string>();
      for (const src of sources) {
        const [row] = await db
          .insert(sourceRecords)
          .values({
            caseId,
            source: src.source,
            endpoint: src.endpoint,
            httpStatus: String(src.httpStatus),
            payload: src.raw,
            // Convention historique source_records (JSON.stringify verbatim).
            payloadHash: payloadHash(src.raw),
            isFixture: src.isFixture ? "true" : "false",
          })
          .returning();
        if (!sourceRecordBySource.has(src.source)) {
          sourceRecordBySource.set(src.source, row.id);
        }
      }

      // 2. Entities + sous-tables (map fixture-id → uuid pour edges/events/signaux)
      const idMap = new Map<string, string>();
      for (const ent of bundle.entities) {
        const mergedAttrs: Record<string, string> = { ...(ent.attributes ?? {}) };
        if (ent.source) mergedAttrs.__source = ent.source;
        if (ent.excerpt) mergedAttrs.__excerpt = ent.excerpt;

        const [row] = await db
          .insert(entities)
          .values({
            caseId,
            type: ent.type,
            label: ent.label,
            evidenceLevel: ent.evidenceLevel,
            naturalKey: ent.id,
            attributes: mergedAttrs,
          })
          .returning();
        idMap.set(ent.id, row.id);

        await db.insert(evidence).values({
          caseId,
          subjectType: "entity",
          subjectId: row.id,
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
          await db.insert(companies).values({
            entityId: row.id,
            siren: (a["SIREN"] ?? "").replace(/\s/g, "") || siren,
            denomination: ent.label,
            formeJuridique: a["Forme juridique"] ?? null,
            nafCode: a["Activité (NAF)"]?.split(/\s|—/)[0] ?? null,
            nafLabel: a["Activité (NAF)"] ?? null,
            etatAdministratif: a["État"] ?? null,
          });
        } else if (ent.type === "person") {
          const { prenoms, nom } = splitPersonName(ent.label);
          const a = ent.attributes ?? {};
          await db.insert(persons).values({
            entityId: row.id,
            nom,
            prenoms,
            qualite: a["Qualité"] ?? null,
            nationalite: a["Nationalité"] ?? null,
          });
        } else if (ent.type === "address") {
          const a = ent.attributes ?? {};
          await db.insert(addresses).values({
            entityId: row.id,
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
        const [edgeRow] = await db
          .insert(edges)
          .values({
            caseId,
            type: edge.type,
            sourceId: src,
            targetId: tgt,
            evidenceLevel: edge.evidenceLevel,
            weight: edge.weight ?? null,
            validFrom: edge.validFrom ?? null,
            validTo: edge.validTo ?? null,
            attributes: { label: edge.label, excerpt: edge.excerpt },
          })
          .returning();
        await db.insert(evidence).values({
          caseId,
          subjectType: "edge",
          subjectId: edgeRow.id,
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
        const [eventRow] = await db
          .insert(events)
          .values({
            caseId,
            entityId: subj,
            kind: ev.kind,
            source: eventSource,
            occurredOn: ev.occurredOn ?? null,
            title: ev.title,
            evidenceLevel: ev.evidenceLevel,
            payload: { source: ev.source },
          })
          .returning();
        await db.insert(evidence).values({
          caseId,
          subjectType: "event",
          subjectId: eventRow.id,
          sourceRecordId: sourceRecordIdFor(eventSource, sourceRecordBySource),
          level: ev.evidenceLevel,
          excerpt: ev.title,
          pointer: { naturalKey: ev.id, kind: ev.kind },
        });
      }

      // 5. Risk signals
      for (const sig of bundle.riskSignals) {
        const subj = sig.subjectId ? (idMap.get(sig.subjectId) ?? null) : null;
        const [signalRow] = await db
          .insert(riskSignals)
          .values({
            caseId,
            ruleId: sig.ruleId,
            subjectType: "entity",
            subjectId: subj,
            severity: sig.severity,
            category: sig.category,
            explanation: sig.explanation,
          })
          .returning();
        await db.insert(evidence).values({
          caseId,
          subjectType: "risk_signal",
          subjectId: signalRow.id,
          sourceRecordId: sourceRecordIdFor(
            inferSignalSource(sig, bundle),
            sourceRecordBySource,
          ),
          level: "inferred",
          excerpt: sig.explanation,
          pointer: { naturalKey: sig.id, ruleId: sig.ruleId },
        });
      }

      // 6. Source records (chaîne de preuve)
      // 7. Tag « prêt »
      const completedAt = new Date();
      await db
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
          },
        })
        .where(eq(cases.id, caseId));

      // 8. Journal de preuve (audit_logs) : la séquence de création chaînée.
      const proofEvents = buildCreationProofEvents({
        caseId,
        bundle,
        sources,
        occurredAt: completedAt.toISOString(),
      });
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
        if (attempt === 1) throw error;
      }
    }
  }

  async listProofEvents(caseId: string): Promise<ProofEvent[]> {
    if (!UUID_RE.test(caseId)) {
      return [...seedJournalFor(caseId), ...journalStore.list(caseId)];
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.caseId, caseId))
      .orderBy(asc(auditLogs.seq));
    return rows.map(rowToProofEvent);
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
