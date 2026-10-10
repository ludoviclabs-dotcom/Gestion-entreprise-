import { describe, it, expect, vi, beforeEach } from "vitest";
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
import type { CaseBundle } from "@/lib/graph/graph-types";
import type { SourceRecordInput } from "@/lib/connectors/types";

const CASE_ID = "11111111-2222-4333-8444-555555555555";

type Row = Record<string, unknown>;
type Op = { kind: "insert" | "update"; table: unknown; rows: Row[]; values?: Row };

const state = vi.hoisted(() => ({
  batches: [] as unknown[][],
  awaited: [] as { kind: string; table: unknown; rows?: unknown[]; values?: unknown }[],
  failBatch: false,
  bundle: null as unknown,
  sources: [] as unknown[],
}));

function makeDb() {
  return {
    insert(table: unknown) {
      return {
        values(rows: Row | Row[]) {
          const arr = Array.isArray(rows) ? rows : [rows];
          const op: Op & { returning: () => Promise<Row[]>; then: (r: (v?: unknown) => void) => void } = {
            kind: "insert",
            table,
            rows: arr,
            returning: async () => {
              // Un aller-retour réel (le dossier est inséré avec `.returning()`).
              state.awaited.push({ kind: "insert", table, rows: arr });
              return arr.map((r) => ({ ...r, id: CASE_ID }));
            },
            then: (resolve) => {
              state.awaited.push({ kind: "insert", table, rows: arr });
              resolve(undefined);
            },
          };
          return op;
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Row) {
          return {
            where() {
              const op = {
                kind: "update" as const,
                table,
                rows: [] as Row[],
                values,
                then: (resolve: (v?: unknown) => void) => {
                  state.awaited.push({ kind: "update", table, values });
                  resolve(undefined);
                },
              };
              return op;
            },
          };
        },
      };
    },
    async batch(items: unknown[]) {
      state.batches.push(items);
      if (state.failBatch) throw new Error("boom: contrainte violée");
      return [];
    },
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: () => makeDb() }));
vi.mock("@/lib/ingestion/assemble-case", () => ({
  assembleCase: async () => ({ bundle: state.bundle, sources: state.sources }),
}));

import { DbCasesRepository } from "@/lib/data/db-repository";

function buildBundle(nEvents: number): CaseBundle {
  return {
    case: { id: "552032534", title: "SOCIETE EXEMPLE", rootSiren: "552032534", scores: { complexite: 10, vigilance: 5, qualitePreuve: 90 } },
    entities: [
      { id: "co:552032534", type: "company", label: "SOCIETE EXEMPLE", evidenceLevel: "confirmed", attributes: { SIREN: "552032534", "Forme juridique": "SA" }, source: "INSEE Sirene — unité légale" },
      { id: "pe:alice-dupont", type: "person", label: "Alice DUPONT", evidenceLevel: "declared", attributes: { Qualité: "Présidente" }, source: "Recherche d'entreprises — dirigeants (RNE)" },
      { id: "pe:bob-martin", type: "person", label: "Bob MARTIN", evidenceLevel: "declared", attributes: {}, source: "INPI / RNE — dirigeants déclarés" },
      { id: "ad:1", type: "address", label: "1 rue de la Paix 75002 Paris", evidenceLevel: "declared", attributes: { "Code postal": "75002", Commune: "Paris" }, source: "INSEE Sirene — adresse du siège" },
    ],
    edges: [
      { id: "e1", type: "DIRIGE", source: "pe:alice-dupont", target: "co:552032534", label: "Présidente", evidenceLevel: "declared", excerpt: "Présidente publiée au RNE.", validFrom: "2020-01-01" },
      { id: "e2", type: "DIRIGE", source: "pe:bob-martin", target: "co:552032534", label: "DG", evidenceLevel: "declared" },
      { id: "e3", type: "PARTAGE_ADRESSE", source: "co:552032534", target: "ad:1", label: "siège", evidenceLevel: "declared", sourceLabel: "INSEE Sirene — siège" },
      // Extrémité absente : doit être ignoré, comme avant.
      { id: "e4", type: "DETIENT", source: "co:inconnu", target: "co:552032534", evidenceLevel: "declared" },
    ],
    events: Array.from({ length: nEvents }, (_, i) => ({
      id: `ev${i}`,
      entityId: "co:552032534",
      kind: "modification",
      title: `Annonce ${i}`,
      occurredOn: "2025-01-01",
      evidenceLevel: "confirmed" as const,
      source: "BODACC",
    })),
    riskSignals: [
      { id: "s1", ruleId: "REGLE_X", subjectId: "co:552032534", severity: "low", category: "vigilance", explanation: "Exemple." },
    ],
  } as CaseBundle;
}

const sources: SourceRecordInput[] = [
  { source: "sirene", endpoint: "https://sirene.test/siren", httpStatus: 200, raw: { a: 1 }, isFixture: false },
  { source: "bodacc", endpoint: "https://bodacc.test", httpStatus: 200, raw: { results: [] }, isFixture: false },
  { source: "recherche_entreprises", endpoint: "https://re.test", httpStatus: 200, raw: { b: 2 }, isFixture: false },
  { source: "inpi", endpoint: "fixture:inpi", httpStatus: 0, raw: {}, isFixture: true },
];

const batchOps = () => state.batches[0] as Op[];
const opsOf = (table: unknown) => batchOps().filter((o) => o.table === table && o.kind === "insert");
const rowsOf = (table: unknown) => opsOf(table).flatMap((o) => o.rows);

describe("DbCasesRepository.createCaseFromSiren — écriture groupée", () => {
  beforeEach(() => {
    state.batches.length = 0;
    state.awaited.length = 0;
    state.failBatch = false;
    state.bundle = buildBundle(12);
    state.sources = sources;
  });

  it("écrit tout le dossier en UNE seule requête transactionnelle", async () => {
    const summary = await new DbCasesRepository().createCaseFromSiren("552032534");
    expect(summary.id).toBe(CASE_ID);
    expect(summary.status).toBe("ready");

    expect(state.batches).toHaveLength(1);
    // Allers-retours hors batch : création du dossier + journal d'audit. Rien d'autre.
    const roundTrips = state.awaited.map((a) => `${a.kind}:${a.table === cases ? "cases" : a.table === auditLogs ? "audit_logs" : "?"}`);
    expect(roundTrips.sort()).toEqual(["insert:audit_logs", "insert:cases"]);
  });

  it("respecte l'ordre des clés étrangères et finit par le passage à « prêt »", async () => {
    await new DbCasesRepository().createCaseFromSiren("552032534");
    const order = batchOps().map((o) => o.table);
    const first = (t: unknown) => order.indexOf(t);
    expect(first(sourceRecords)).toBeLessThan(first(entities));
    expect(first(entities)).toBeLessThan(first(companies));
    expect(first(entities)).toBeLessThan(first(edges));
    expect(first(entities)).toBeLessThan(first(events));
    expect(first(sourceRecords)).toBeLessThan(first(evidence));
    const last = batchOps()[batchOps().length - 1];
    expect(last.kind).toBe("update");
    expect(last.table).toBe(cases);
    expect(last.values).toMatchObject({ status: "ready" });
  });

  it("garde la cohérence des identifiants (aucune ligne orpheline)", async () => {
    await new DbCasesRepository().createCaseFromSiren("552032534");
    const entityIds = new Set(rowsOf(entities).map((r) => r.id as string));
    const edgeIds = new Set(rowsOf(edges).map((r) => r.id as string));
    const eventIds = new Set(rowsOf(events).map((r) => r.id as string));
    const signalIds = new Set(rowsOf(riskSignals).map((r) => r.id as string));
    const sourceIds = new Set(rowsOf(sourceRecords).map((r) => r.id as string));

    expect(entityIds.size).toBe(4);
    for (const r of rowsOf(companies)) expect(entityIds.has(r.entityId as string)).toBe(true);
    for (const r of rowsOf(persons)) expect(entityIds.has(r.entityId as string)).toBe(true);
    for (const r of rowsOf(addresses)) expect(entityIds.has(r.entityId as string)).toBe(true);
    for (const r of rowsOf(edges)) {
      expect(entityIds.has(r.sourceId as string)).toBe(true);
      expect(entityIds.has(r.targetId as string)).toBe(true);
    }
    for (const r of rowsOf(events)) expect(entityIds.has(r.entityId as string)).toBe(true);

    const allSubjects = new Set([...entityIds, ...edgeIds, ...eventIds, ...signalIds]);
    for (const r of rowsOf(evidence)) {
      expect(allSubjects.has(r.subjectId as string)).toBe(true);
      if (r.sourceRecordId) expect(sourceIds.has(r.sourceRecordId as string)).toBe(true);
    }
    // 4 entités + 3 liens valides + 12 événements + 1 signal.
    expect(rowsOf(evidence)).toHaveLength(4 + 3 + 12 + 1);
    // Le lien à extrémité inconnue est ignoré.
    expect(edgeIds.size).toBe(3);
  });

  it("préserve les champs métier (temporalité, SIREN, nom, provenance)", async () => {
    await new DbCasesRepository().createCaseFromSiren("552032534");
    const e1 = rowsOf(edges).find((r) => (r.attributes as Row)?.label === "Présidente");
    expect(e1?.validFrom).toBe("2020-01-01");
    expect(rowsOf(companies)[0]).toMatchObject({ siren: "552032534", formeJuridique: "SA" });
    expect(rowsOf(persons).find((r) => r.nom === "DUPONT")).toMatchObject({ prenoms: "Alice", qualite: "Présidente" });
    // Provenance : l'entité Recherche d'entreprises référence SON source_record.
    const re = rowsOf(sourceRecords).find((r) => r.source === "recherche_entreprises");
    const aliceEntity = rowsOf(entities).find((r) => r.label === "Alice DUPONT");
    const aliceEvidence = rowsOf(evidence).find((r) => r.subjectId === aliceEntity?.id);
    expect(aliceEvidence?.sourceRecordId).toBe(re?.id);
  });

  it("persiste Camino avec sa source et sa preuve, sans repli BODACC", async () => {
    const bundle = buildBundle(1);
    bundle.events.push({ id: "ev:camino:mine:debut", entityId: "co:552032534", kind: "titre_minier_debut",
      title: "Début déclaré du titre Mine", occurredOn: "2000-01-01", evidenceLevel: "declared", source: "Titres miniers (Camino)" });
    state.bundle = bundle;
    state.sources = [...sources, { source: "camino", endpoint: "db:camino_titres?siren=552032534", httpStatus: 200, isFixture: false, raw: { status: "ok" } }];
    await new DbCasesRepository().createCaseFromSiren("552032534");
    const stored = rowsOf(events).find(r => r.kind === "titre_minier_debut");
    const source = rowsOf(sourceRecords).find(r => r.source === "camino");
    expect(stored?.source).toBe("camino");
    expect(source?.id).toBeDefined();
    expect(rowsOf(evidence).find(r => r.subjectId === stored?.id)?.sourceRecordId).toBe(source?.id);
    expect(rowsOf(events).find(r => r.kind === "modification")?.source).toBe("bodacc");
  });

  it("découpe les gros lots et n'émet jamais d'insertion vide", async () => {
    state.bundle = buildBundle(1100);
    await new DbCasesRepository().createCaseFromSiren("552032534");
    const eventOps = opsOf(events);
    expect(eventOps).toHaveLength(3); // 500 + 500 + 100
    expect(eventOps.every((o) => o.rows.length > 0 && o.rows.length <= 500)).toBe(true);
    // Aucune ligne `addresses` → pas d'instruction vide ; ici il y en a une.
    for (const o of batchOps()) if (o.kind === "insert") expect(o.rows.length).toBeGreaterThan(0);
  });

  it("sans adresse ni personne : aucune instruction vide pour ces tables", async () => {
    state.bundle = {
      case: { id: "x", title: "X", rootSiren: "552032534" },
      entities: [{ id: "co:552032534", type: "company", label: "X", evidenceLevel: "confirmed", attributes: { SIREN: "552032534" } }],
      edges: [],
      events: [],
      riskSignals: [],
    } as CaseBundle;
    await new DbCasesRepository().createCaseFromSiren("552032534");
    expect(opsOf(addresses)).toHaveLength(0);
    expect(opsOf(persons)).toHaveLength(0);
    expect(opsOf(edges)).toHaveLength(0);
  });

  it("échec du lot : le dossier est marqué « error » et l'erreur est propagée", async () => {
    state.failBatch = true;
    await expect(new DbCasesRepository().createCaseFromSiren("552032534")).rejects.toThrow("boom");
    const update = state.awaited.find((a) => a.kind === "update");
    expect(update?.values).toMatchObject({ status: "error" });
    // Rien d'autre n'a été écrit hors dossier (pas d'audit_logs).
    expect(state.awaited.some((a) => a.table === auditLogs)).toBe(false);
  });
});
