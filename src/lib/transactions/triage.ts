import { findSharedIbans } from "@/lib/iban";
import {
  analyzeTransactions,
  OUTLIER_THRESHOLD,
  robustDispersion,
  type TransactionReport,
} from "@/lib/risk/transactional";
import type { Tone } from "@/lib/design/tone";
import type { TransactionRecord } from "./ingest";

/**
 * Triage d'un relevé importé — fonctions PURES. Chaque transaction reçoit les
 * signaux des détecteurs existants (doublons, montants atypiques — MAD —, IBAN
 * partagés ou invalides) avec leur MOTIF écrit, puis un niveau de vigilance
 * dérivé d'une règle affichée. Aucun signal n'est une conclusion : il oriente
 * la revue humaine. Rien n'est inventé : sans donnée, pas de signal.
 */

// ── Signaux ────────────────────────────────────────────────────────────────

export type SignalKind = "duplicate" | "outlier" | "shared_iban" | "invalid_iban";

export const SIGNAL_KINDS: SignalKind[] = ["duplicate", "outlier", "shared_iban", "invalid_iban"];

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  duplicate: "Doublon",
  outlier: "Montant atypique",
  shared_iban: "IBAN partagé",
  invalid_iban: "IBAN invalide",
};

export type TxSignal = {
  kind: SignalKind;
  label: string;
  /** Explication du motif, en clair, à partir des données du fichier. */
  motif: string;
  /** Transactions liées au même motif (identifiants locaux). */
  related: string[];
};

// ── Niveau de vigilance (règle affichée dans l'interface) ──────────────────

export type RiskLevel = "renforcee" | "vigilance" | "aucun";

export const RISK_LABELS: Record<RiskLevel, string> = {
  renforcee: "Vigilance renforcée",
  vigilance: "Vigilance",
  aucun: "Aucun signal",
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  renforcee: "critical",
  vigilance: "vigilance",
  aucun: "neutral",
};

export const RISK_RULE =
  "Vigilance : un signal. Vigilance renforcée : au moins deux signaux de nature différente.";

const RISK_RANK: Record<RiskLevel, number> = { renforcee: 2, vigilance: 1, aucun: 0 };

export function riskOf(signals: TxSignal[]): RiskLevel {
  const kinds = new Set(signals.map((s) => s.kind)).size;
  return kinds >= 2 ? "renforcee" : kinds === 1 ? "vigilance" : "aucun";
}

// ── Statut de triage (saisi par l'analyste, jamais calculé) ────────────────

export type TriageStatus = "a_trier" | "en_revue" | "traitee";

export const TRIAGE_STATUSES: TriageStatus[] = ["a_trier", "en_revue", "traitee"];

export const TRIAGE_LABELS: Record<TriageStatus, string> = {
  a_trier: "À trier",
  en_revue: "En revue",
  traitee: "Traitée",
};

export const TRIAGE_TONE: Record<TriageStatus, Tone> = {
  a_trier: "neutral",
  en_revue: "vigilance",
  traitee: "success",
};

// ── Analyse ────────────────────────────────────────────────────────────────

export type TriagedTransaction = TransactionRecord & {
  signals: TxSignal[];
  risk: RiskLevel;
};

export type TriageResult = {
  items: TriagedTransaction[];
  report: TransactionReport;
  /** Médiane et dispersion robuste des montants (motif des montants atypiques). */
  dispersion: { median: number; mad: number } | null;
  ibanStats: { withIban: number; valid: number; shared: number };
};

const plainAmount = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const lines = (records: TransactionRecord[]) =>
  records.map((r) => r.line).join(", ");

export function triageTransactions(records: TransactionRecord[]): TriageResult {
  const report = analyzeTransactions(
    records.map((r) => ({
      id: r.id,
      amount: r.amount,
      date: r.date ?? r.dateRaw,
      counterparty: r.counterparty,
      label: r.counterparty,
    })),
  );
  const dispersion = robustDispersion(records.map((r) => r.amount));
  const byId = new Map(records.map((r) => [r.id, r]));
  const signals = new Map<string, TxSignal[]>(records.map((r) => [r.id, []]));
  const add = (id: string, signal: TxSignal) => signals.get(id)?.push(signal);

  for (const group of report.duplicates) {
    for (const t of group.transactions) {
      const others = group.transactions
        .filter((o) => o.id !== t.id)
        .map((o) => byId.get(o.id))
        .filter((o): o is TransactionRecord => Boolean(o));
      add(t.id, {
        kind: "duplicate",
        label: SIGNAL_LABELS.duplicate,
        motif: `Même montant (${plainAmount(group.amount)}) et même contrepartie que ${others.length} autre${others.length > 1 ? "s" : ""} transaction${others.length > 1 ? "s" : ""} (ligne${others.length > 1 ? "s" : ""} ${lines(others)}). Peut être légitime (loyer, abonnement) : à corroborer.`,
        related: others.map((o) => o.id),
      });
    }
  }

  for (const outlier of report.outliers) {
    const record = records[outlier.index];
    if (!record) continue;
    add(record.id, {
      kind: "outlier",
      label: SIGNAL_LABELS.outlier,
      motif: dispersion
        ? `Écart à la médiane des montants du fichier (${plainAmount(dispersion.median)}) égal à ${outlier.score.toFixed(1).replace(".", ",")} fois la dispersion robuste (seuil ${String(OUTLIER_THRESHOLD).replace(".", ",")}).`
        : `Score de déviation robuste ${outlier.score.toFixed(1).replace(".", ",")} (seuil ${String(OUTLIER_THRESHOLD).replace(".", ",")}).`,
      related: [],
    });
  }

  const withIban = records.filter((r) => r.iban);
  const valid = withIban.filter((r) => r.ibanValid);
  const shared = findSharedIbans(
    valid.map((r) => ({ id: r.counterparty ? `cp:${r.counterparty}` : `tx:${r.id}`, iban: r.iban as string })),
  );
  for (const { iban } of shared) {
    const users = valid.filter((r) => r.iban === iban);
    for (const r of users) {
      const others = users.filter(
        (o) => o.id !== r.id && (o.counterparty ?? `tx:${o.id}`) !== (r.counterparty ?? `tx:${r.id}`),
      );
      const names = [...new Set(others.map((o) => o.counterparty ?? `ligne ${o.line}`))];
      add(r.id, {
        kind: "shared_iban",
        label: SIGNAL_LABELS.shared_iban,
        motif: `IBAN également associé à ${names.length} autre${names.length > 1 ? "s" : ""} contrepartie${names.length > 1 ? "s" : ""} : ${names.join(", ")}.`,
        related: others.map((o) => o.id),
      });
    }
  }

  for (const r of withIban) {
    if (r.ibanValid) continue;
    add(r.id, {
      kind: "invalid_iban",
      label: SIGNAL_LABELS.invalid_iban,
      motif: "Structure ou clé de contrôle ISO 13616 invalide : l'IBAN ne peut pas être rapproché d'autres transactions.",
      related: [],
    });
  }

  return {
    items: records.map((r) => {
      const s = signals.get(r.id) ?? [];
      return { ...r, signals: s, risk: riskOf(s) };
    }),
    report,
    dispersion,
    ibanStats: { withIban: withIban.length, valid: valid.length, shared: shared.length },
  };
}

// ── Pays (colonne du fichier, sinon pays de l'IBAN) ────────────────────────

export function countryOf(t: TransactionRecord): string | undefined {
  return t.country ?? t.ibanCountry;
}

// ── Filtres ────────────────────────────────────────────────────────────────

export type TxFilters = {
  /** Période, bornes incluses (AAAA-MM-JJ). */
  from?: string;
  to?: string;
  status?: TriageStatus;
  /** Niveau de vigilance, ou « signalee » = au moins un signal. */
  risk?: RiskLevel | "signalee";
  /** Bornes sur la valeur ABSOLUE du montant. */
  min?: number;
  max?: number;
  /** Code devise, ou « inconnue » = devise non précisée. */
  currency?: string;
  /** Recherche dans la contrepartie et le libellé. */
  q?: string;
  country?: string;
  signal?: SignalKind | "aucun";
  /** Dossier KYB Graph rapproché par SIREN. */
  linked?: "oui" | "non";
};

export type SortKey = "date" | "montant" | "risque" | "ligne";
export type Sort = { key: SortKey; dir: "asc" | "desc" };
export const DEFAULT_SORT: Sort = { key: "ligne", dir: "asc" };

export const UNKNOWN_CURRENCY = "inconnue";

function norm(s: string | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesFilters(
  t: TriagedTransaction,
  f: TxFilters,
  ctx: { status: TriageStatus; linked: boolean },
): boolean {
  if (f.from && (!t.date || t.date < f.from)) return false;
  if (f.to && (!t.date || t.date > f.to)) return false;
  if (f.status && ctx.status !== f.status) return false;
  if (f.risk === "signalee" && t.signals.length === 0) return false;
  if (f.risk && f.risk !== "signalee" && t.risk !== f.risk) return false;
  const abs = Math.abs(t.amount);
  if (f.min !== undefined && abs < f.min) return false;
  if (f.max !== undefined && abs > f.max) return false;
  if (f.currency === UNKNOWN_CURRENCY && t.currency) return false;
  if (f.currency && f.currency !== UNKNOWN_CURRENCY && t.currency !== f.currency) return false;
  if (f.q) {
    const needle = norm(f.q.trim());
    if (needle && !norm(`${t.counterparty ?? ""} ${t.label ?? ""}`).includes(needle)) return false;
  }
  if (f.country && countryOf(t) !== f.country) return false;
  if (f.signal === "aucun" && t.signals.length > 0) return false;
  if (f.signal && f.signal !== "aucun" && !t.signals.some((s) => s.kind === f.signal)) return false;
  if (f.linked === "oui" && !ctx.linked) return false;
  if (f.linked === "non" && ctx.linked) return false;
  return true;
}

export function sortTransactions(items: TriagedTransaction[], sort: Sort): TriagedTransaction[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const byLine = (a: TriagedTransaction, b: TriagedTransaction) => a.line - b.line;
  return [...items].sort((a, b) => {
    let d = 0;
    if (sort.key === "date") {
      // Les dates absentes ou illisibles vont toujours en fin de liste.
      if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : byLine(a, b);
      d = a.date.localeCompare(b.date);
    } else if (sort.key === "montant") d = Math.abs(a.amount) - Math.abs(b.amount);
    else if (sort.key === "risque") d = RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.signals.length - b.signals.length;
    else d = byLine(a, b);
    return d * dir || byLine(a, b);
  });
}

// ── Sérialisation dans l'URL (état des filtres conservé) ───────────────────

const PARAM = {
  from: "du",
  to: "au",
  status: "statut",
  risk: "risque",
  min: "min",
  max: "max",
  currency: "devise",
  q: "q",
  country: "pays",
  signal: "signal",
  linked: "dossier",
} as const satisfies Record<keyof TxFilters, string>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function filtersFromParams(params: URLSearchParams): { filters: TxFilters; sort: Sort } {
  const get = (k: keyof TxFilters) => params.get(PARAM[k]) ?? undefined;
  const num = (v: string | undefined) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[]) =>
    v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

  const filters: TxFilters = {
    from: DATE.test(get("from") ?? "") ? get("from") : undefined,
    to: DATE.test(get("to") ?? "") ? get("to") : undefined,
    status: oneOf(get("status"), TRIAGE_STATUSES),
    risk: oneOf(get("risk"), ["renforcee", "vigilance", "aucun", "signalee"] as const),
    min: num(get("min")),
    max: num(get("max")),
    currency: get("currency"),
    q: get("q"),
    country: get("country"),
    signal: oneOf(get("signal"), [...SIGNAL_KINDS, "aucun"] as const),
    linked: oneOf(get("linked"), ["oui", "non"] as const),
  };
  const tri = params.get("tri") ?? "";
  const key = oneOf(tri.replace(/^-/, ""), ["date", "montant", "risque", "ligne"] as const);
  const sort: Sort = key ? { key, dir: tri.startsWith("-") ? "desc" : "asc" } : DEFAULT_SORT;
  return { filters: clean(filters), sort };
}

export function filtersToParams(filters: TxFilters, sort: Sort): URLSearchParams {
  const params = new URLSearchParams();
  for (const k of Object.keys(PARAM) as (keyof TxFilters)[]) {
    const v = filters[k];
    if (v !== undefined && v !== "") params.set(PARAM[k], String(v));
  }
  if (sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir) {
    params.set("tri", `${sort.dir === "desc" ? "-" : ""}${sort.key}`);
  }
  return params;
}

/** Retire les clés vides. */
export function clean(filters: TxFilters): TxFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  ) as TxFilters;
}

export function activeFilterCount(filters: TxFilters): number {
  return Object.keys(clean(filters)).length;
}

// ── Synthèse (en-tête) ─────────────────────────────────────────────────────

export type CurrencyVolume = { currency?: string; debit: number; credit: number; count: number };

export type TransactionsSummary = {
  count: number;
  period: { from: string; to: string } | null;
  /** Transactions sans date interprétable (exclues de la période). */
  undated: number;
  /** Volumes par devise — jamais additionnés entre devises différentes. */
  volumes: CurrencyVolume[];
  signaled: number;
  byRisk: Record<RiskLevel, number>;
};

export function summarize(items: TriagedTransaction[]): TransactionsSummary {
  const dates = items.map((t) => t.date).filter((d): d is string => Boolean(d)).sort();
  const volumes = new Map<string, CurrencyVolume>();
  const byRisk: Record<RiskLevel, number> = { renforcee: 0, vigilance: 0, aucun: 0 };
  for (const t of items) {
    const key = t.currency ?? "";
    const v = volumes.get(key) ?? { currency: t.currency, debit: 0, credit: 0, count: 0 };
    if (t.amount < 0) v.debit += -t.amount;
    else v.credit += t.amount;
    v.count += 1;
    volumes.set(key, v);
    byRisk[t.risk] += 1;
  }
  return {
    count: items.length,
    period: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    undated: items.length - dates.length,
    volumes: [...volumes.values()].sort((a, b) => b.count - a.count),
    signaled: items.filter((t) => t.signals.length > 0).length,
    byRisk,
  };
}
