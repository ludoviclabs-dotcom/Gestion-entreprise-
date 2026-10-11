import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cases,
  events,
  evidence,
  riskSignals,
  sourceRecords,
} from "@/lib/db/schema";
import type { CaseBundle } from "@/lib/graph/graph-types";
import type { ConnectorResult } from "@/lib/connectors/types";
import { planPressCompletion } from "@/lib/data/press-completion";
import { isPressStale, pressOf, PRESS_STALE_MS } from "@/lib/data/press-status";

const CASE_ID = "11111111-2222-4333-8444-555555555555";
const SUBJECT = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "aaaaaaaa-0000-4000-8000-000000000002";

type Row = Record<string, unknown>;
type Op = { kind: "insert" | "update"; table: unknown; rows: Row[]; values?: Row };

const state = vi.hoisted(() => ({
  batches: [] as unknown[][],
  updates: [] as { table: unknown; values: unknown }[],
  caseRow: null as Record<string, unknown> | null,
  gdelt: null as unknown,
  failBatch: false,
  proof: [] as { kind: string; payload: Record<string, unknown> }[],
}));

function makeDb() {
  const select = () => {
    const chain: Record<string, unknown> = {};
    const result = () => {
      // La jointure sujet renvoie l'id de l'entité ; sinon la ligne du dossier.
      return chain.__join ? [{ id: SUBJECT }] : state.caseRow ? [state.caseRow] : [];
    };
    chain.from = () => chain;
    chain.innerJoin = () => {
      chain.__join = true;
      return chain;
    };
    chain.where = () => chain;
    chain.limit = async () => result();
    chain.then = (resolve: (v: unknown) => void) => resolve(result());
    return chain;
  };
  return {
    select,
    insert(table: unknown) {
      return {
        values(rows: Row | Row[]) {
          return { kind: "insert", table, rows: Array.isArray(rows) ? rows : [rows] } as Op;
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Row) {
          return {
            where() {
              const op = { kind: "update", table, rows: [], values } as Op;
              // Mise à jour hors batch (état « failed ») : enregistrée au await.
              (op as unknown as { then: unknown }).then = (resolve: (v?: unknown) => void) => {
                state.updates.push({ table, values });
                resolve(undefined);
              };
              return op;
            },
          };
        },
      };
    },
    async batch(items: unknown[]) {
      state.batches.push(items);
      if (state.failBatch) throw new Error("boom");
      return [];
    },
  };
}

vi.mock("@/lib/db/client", () => ({ getDb: () => makeDb() }));
vi.mock("@/lib/connectors/gdelt", () => ({
  gdelt: { byName: async () => state.gdelt },
}));
vi.mock("@/lib/ingestion/assemble-case", () => ({ assembleCase: vi.fn() }));

import { DbCasesRepository } from "@/lib/data/db-repository";

const ok = (raw: unknown): ConnectorResult<unknown> => ({
  raw,
  endpoint: "https://api.gdeltproject.org/api/v2/doc/doc?query=SOCIETE",
  httpStatus: 200,
  isFixture: false,
});

const article = (i: number, tone: number) => ({
  title: `SOCIETE EXEMPLE visée par une enquête ${i}`,
  url: `https://presse.test/${i}`,
  domain: "presse.test",
  seendate: "20261001T080000Z",
  tone,
});

function bundle(): CaseBundle {
  return {
    case: {
      id: CASE_ID,
      title: "SOCIETE EXEMPLE",
      rootSiren: "552032534",
      scores: { complexite: 40, vigilance: 8, qualitePreuve: 100 },
    },
    entities: [
      { id: SUBJECT, type: "company", label: "SOCIETE EXEMPLE", evidenceLevel: "confirmed", attributes: {} },
      { id: OTHER, type: "person", label: "Alice DUPONT", evidenceLevel: "declared", attributes: {} },
    ],
    edges: [],
    events: [],
    riskSignals: [
      { id: "s1", ruleId: "REGLE_X", subjectId: SUBJECT, severity: "low", category: "vigilance", explanation: "Exemple." },
    ],
  } as unknown as CaseBundle;
}

const sources = [
  { source: "sirene" as const, endpoint: "https://sirene.test", httpStatus: 200, isFixture: false },
  { source: "bodacc" as const, endpoint: "https://bodacc.test", httpStatus: 200, isFixture: false },
];

describe("planPressCompletion — calcul complémentaire sans recalcul global", () => {
  it("articles défavorables : événements, signal média, vigilance et preuve mis à jour", () => {
    const plan = planPressCompletion({
      caseId: CASE_ID,
      bundle: bundle(),
      sources,
      gdelt: ok({ articles: [article(1, -6), article(2, -5), article(3, 1)] }),
      subjectId: SUBJECT,
    });
    expect(plan.usable).toBe(true);
    expect(plan.events).toHaveLength(3);
    expect(plan.signals).toHaveLength(1);
    expect(plan.signals[0]).toMatchObject({
      ruleId: "COUVERTURE_MEDIA_DEFAVORABLE",
      severity: "medium",
      subjectId: SUBJECT,
    });
    // 1 signal « low » existant (3 pts) + 1 « medium » (7 pts) = 10/40 → 25.
    expect(plan.scores.vigilance).toBe(25);
    // 3 événements « inferred » dans un dossier jusque-là 100 % solide : 2 sur 5.
    expect(plan.scores.qualitePreuve).toBe(40);
    // La complexité (graphe) n'est pas touchée.
    expect(plan.scores.complexite).toBe(40);
    // Chaque ligne d'événement/signal a sa preuve, rattachée au source_record gdelt.
    expect(plan.evidenceRows).toHaveLength(3 + 1);
    for (const row of plan.evidenceRows) {
      expect(row.sourceRecordId).toBe(plan.sourceRecord.id);
    }
    expect(plan.sourceHealth.total).toBe(3);
    expect(plan.sourceHealth.failed).toBe(0);
  });

  it("un seul article défavorable : événements, mais aucun signal (seuil du faisceau)", () => {
    const plan = planPressCompletion({
      caseId: CASE_ID,
      bundle: bundle(),
      sources,
      gdelt: ok({ articles: [article(1, -6)] }),
      subjectId: SUBJECT,
    });
    expect(plan.events).toHaveLength(1);
    expect(plan.signals).toHaveLength(0);
    expect(plan.scores.vigilance).toBe(8);
  });

  it("consultation en échec : source tracée en échec, aucun événement, scores inchangés", () => {
    const plan = planPressCompletion({
      caseId: CASE_ID,
      bundle: bundle(),
      sources,
      gdelt: {
        raw: { articles: [article(1, -9), article(2, -9)] },
        endpoint: "https://api.gdeltproject.org/api/v2/doc/doc (erreur 429)",
        httpStatus: 429,
        isFixture: false,
      },
      subjectId: SUBJECT,
    });
    expect(plan.usable).toBe(false);
    expect(plan.events).toHaveLength(0);
    expect(plan.signals).toHaveLength(0);
    expect(plan.scores).toEqual({ complexite: 40, vigilance: 8, qualitePreuve: 100 });
    expect(plan.sourceRecord.httpStatus).toBe("429");
    expect(plan.sourceHealth.failed).toBe(1);
  });

  it("HTTP 200 mais consultation dégradée (délai dépassé) : non exploitable", () => {
    const plan = planPressCompletion({
      caseId: CASE_ID,
      bundle: bundle(),
      sources,
      gdelt: {
        raw: { articles: [] },
        endpoint: "https://api.gdeltproject.org/api/v2/doc/doc (délai dépassé)",
        httpStatus: 200,
        isFixture: false,
      },
      subjectId: SUBJECT,
    });
    expect(plan.usable).toBe(false);
    expect(plan.sourceHealth.failed).toBe(1);
  });
});

describe("état de la collecte de presse", () => {
  it("lit l'état persisté et ignore une valeur illisible", () => {
    expect(pressOf({ press: { state: "pending", requestedAt: "2026-10-10T10:00:00Z" } })).toEqual({
      state: "pending",
      requestedAt: "2026-10-10T10:00:00Z",
    });
    expect(pressOf({ press: { state: "n'importe quoi" } })).toBeUndefined();
    expect(pressOf({})).toBeUndefined();
    expect(pressOf(null)).toBeUndefined();
  });

  it("une collecte en attente trop ancienne est considérée interrompue", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    const recent = { state: "pending" as const, requestedAt: new Date(now - 30_000).toISOString() };
    const old = { state: "pending" as const, requestedAt: new Date(now - PRESS_STALE_MS - 1).toISOString() };
    expect(isPressStale(recent, now)).toBe(false);
    expect(isPressStale(old, now)).toBe(true);
    expect(isPressStale({ state: "done" }, now)).toBe(false);
  });
});

describe("DbCasesRepository.completePendingPress", () => {
  const batchOps = () => state.batches[0] as Op[];
  const rows = (table: unknown) =>
    batchOps()
      .filter((o) => o.kind === "insert" && o.table === table)
      .flatMap((o) => o.rows);

  beforeEach(() => {
    vi.restoreAllMocks();
    state.batches.length = 0;
    state.updates.length = 0;
    state.failBatch = false;
    state.caseRow = {
      id: CASE_ID,
      title: "SOCIETE EXEMPLE",
      rootSiren: "552032534",
      scoreComplexite: 40,
      metadata: {
        scoreModelVersion: "kyb-risk-2026.2",
        timings: { bodacc: 300, _total: 4200 },
        press: { state: "pending", requestedAt: "2026-10-10T10:00:00.000Z" },
      },
    };
    state.gdelt = ok({ articles: [article(1, -6), article(2, -5)] });
    vi.spyOn(DbCasesRepository.prototype, "getCase").mockResolvedValue({
      bundle: bundle(),
      sources,
      evidence: [],
    } as never);
    vi.spyOn(DbCasesRepository.prototype, "appendProofEvent").mockImplementation(
      async (_id, kind, payload) => {
        state.proof.push({ kind, payload });
      },
    );
    state.proof.length = 0;
  });

  it("écrit presse, événements, signal, preuve et scores en UNE requête transactionnelle", async () => {
    await new DbCasesRepository().completePendingPress(CASE_ID);

    expect(state.batches).toHaveLength(1);
    const gdeltRecord = rows(sourceRecords)[0];
    expect(gdeltRecord).toMatchObject({ source: "gdelt", caseId: CASE_ID, httpStatus: "200" });
    expect(rows(events)).toHaveLength(2);
    expect(rows(events).every((r) => r.source === "gdelt" && r.entityId === SUBJECT)).toBe(true);
    expect(rows(riskSignals)).toHaveLength(1);
    expect(rows(riskSignals)[0]).toMatchObject({ ruleId: "COUVERTURE_MEDIA_DEFAVORABLE", subjectId: SUBJECT });
    // Chaque ligne de preuve référence le source_record gdelt écrit dans le même lot.
    const evidenceRows = rows(evidence);
    expect(evidenceRows).toHaveLength(3);
    expect(evidenceRows.every((r) => r.sourceRecordId === gdeltRecord.id)).toBe(true);

    // Le passage de la presse à « done » et les scores sont la DERNIÈRE instruction.
    const last = batchOps()[batchOps().length - 1];
    expect(last.table).toBe(cases);
    expect(last.values).toMatchObject({ scoreVigilance: 25, scoreQualitePreuve: 50 });
    const metadata = last.values?.metadata as Record<string, unknown>;
    expect(metadata.press).toMatchObject({ state: "done", requestedAt: "2026-10-10T10:00:00.000Z" });
    // Les métadonnées existantes sont conservées ; la durée de la presse est ajoutée.
    expect(metadata.scoreModelVersion).toBe("kyb-risk-2026.2");
    expect(metadata.timings).toMatchObject({ bodacc: 300, _total: 4200 });
    expect(typeof (metadata.timings as Record<string, number>).gdelt).toBe("number");
    expect(metadata.sourceHealth).toMatchObject({ total: 3 });

    // Journal de preuve : consultation puis recalcul complémentaire.
    expect(state.proof.map((p) => p.kind)).toEqual(["source_consultee", "risque_calcule"]);
    expect(state.proof[1].payload).toMatchObject({ complement: "presse", scoreModelVersion: "kyb-risk-2026.2" });
  });

  it("n'agit pas si la presse n'est pas en attente (déjà collectée)", async () => {
    state.caseRow = { ...state.caseRow, metadata: { press: { state: "done" } } };
    await new DbCasesRepository().completePendingPress(CASE_ID);
    expect(state.batches).toHaveLength(0);
    expect(state.proof).toHaveLength(0);
  });

  it("n'agit pas sur une fixture (identifiant non UUID)", async () => {
    await new DbCasesRepository().completePendingPress("demo-orion");
    expect(state.batches).toHaveLength(0);
  });

  it("échec d'écriture : ne lève jamais et marque la presse « failed »", async () => {
    state.failBatch = true;
    await expect(new DbCasesRepository().completePendingPress(CASE_ID)).resolves.toBeUndefined();
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].table).toBe(cases);
    expect(state.proof).toHaveLength(0);
  });
});
