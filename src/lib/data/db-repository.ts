import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  cases,
  entities,
  companies,
  persons,
  addresses,
  edges,
  events,
  riskSignals,
  sourceRecords,
} from "@/lib/db/schema";
import { assembleCase } from "@/lib/ingestion/assemble-case";
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
  SourceRow,
} from "./types";

// SHA-256 d'un payload (intégrité + dédup dans source_records).
function sha256(input: unknown): string {
  const buf = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(buf).digest("hex");
}

type EntityAttrs = Record<string, string>;

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
           WHERE case_id = c.id AND severity = 'high')            AS high_count
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
    };
    const list =
      (rows as unknown as { rows?: Row[] }).rows ?? (rows as unknown as Row[]);

    return list.map((r) => ({
      id: r.id,
      title: r.title,
      rootSiren: r.root_siren,
      status: r.status,
      scores: {
        complexite: r.score_complexite ?? undefined,
        vigilance: r.score_vigilance ?? undefined,
        qualitePreuve: r.score_qualite_preuve ?? undefined,
      },
      counts: {
        entities: r.entities_count ?? 0,
        edges: r.edges_count ?? 0,
        signalsHigh: r.high_count ?? 0,
      },
      updatedAt:
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : new Date(r.updated_at).toISOString(),
    }));
  }

  async getCase(id: string): Promise<CaseDetail | null> {
    const db = getDb();
    const [caseRow] = await db.select().from(cases).where(eq(cases.id, id));
    if (!caseRow) return null;

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
      source: s.source,
      endpoint: s.endpoint,
      httpStatus: Number(s.httpStatus ?? 0),
      isFixture: s.isFixture === "true",
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
      },
      entities: bundleEntities,
      edges: bundleEdges,
      events: bundleEvents,
      riskSignals: bundleSignals,
    };

    return { bundle, sources };
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
      })
      .returning();
    const caseId = caseRow.id;

    try {
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
        await db.insert(edges).values({
          caseId,
          type: edge.type,
          sourceId: src,
          targetId: tgt,
          evidenceLevel: edge.evidenceLevel,
          weight: edge.weight ?? null,
          attributes: { label: edge.label, excerpt: edge.excerpt },
        });
      }

      // 4. Events
      for (const ev of bundle.events) {
        const subj = idMap.get(ev.entityId);
        if (!subj) continue;
        await db.insert(events).values({
          caseId,
          entityId: subj,
          kind: ev.kind,
          source: "bodacc",
          occurredOn: ev.occurredOn ?? null,
          title: ev.title,
          evidenceLevel: ev.evidenceLevel,
          payload: { source: ev.source },
        });
      }

      // 5. Risk signals
      for (const sig of bundle.riskSignals) {
        const subj = sig.subjectId ? (idMap.get(sig.subjectId) ?? null) : null;
        await db.insert(riskSignals).values({
          caseId,
          ruleId: sig.ruleId,
          subjectType: "entity",
          subjectId: subj,
          severity: sig.severity,
          category: sig.category,
          explanation: sig.explanation,
        });
      }

      // 6. Source records (chaîne de preuve)
      for (const src of sources) {
        await db.insert(sourceRecords).values({
          caseId,
          source: src.source,
          endpoint: src.endpoint,
          httpStatus: String(src.httpStatus),
          payload: src.raw,
          payloadHash: sha256(src.raw),
          isFixture: src.isFixture ? "true" : "false",
        });
      }

      // 7. Tag « prêt »
      await db
        .update(cases)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(cases.id, caseId));

      return {
        id: caseId,
        title: bundle.case.title,
        rootSiren: siren,
        status: "ready",
        scores: bundle.case.scores ?? {},
        counts: {
          entities: bundle.entities.length,
          edges: bundle.edges.length,
          signalsHigh: bundle.riskSignals.filter((s) => s.severity === "high")
            .length,
        },
        updatedAt: new Date().toISOString(),
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
}
