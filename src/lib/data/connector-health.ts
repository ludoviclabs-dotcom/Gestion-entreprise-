import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import type { SourceKind } from "@/lib/graph/source";

/**
 * Fonctionnement OBSERVÉ des connecteurs, déduit des consultations réellement
 * enregistrées (`source_records`) — par opposition à la configuration (variables
 * d'environnement) que dit `getConnectorStatuses()`.
 *
 * Une clé posée n'est pas une source qui répond : OpenSanctions (clé refusée,
 * HTTP 402) ou Pappers (crédits épuisés, HTTP 401) restaient « Live ».
 */
export const HEALTH_WINDOW_DAYS = 7;
/** Consultations conservées par source pour juger de son état. */
export const HEALTH_SAMPLE = 20;
/** Les N dernières consultations toutes en échec → « en échec » (et non « dégradé »). */
const FAILING_STREAK = 3;
/**
 * Taux de réussite au plus égal à ce seuil, sur au moins `FAILING_RATE_MIN_SAMPLE`
 * consultations → « en échec », même si la dernière a réussi : une source qui échoue
 * 19 fois sur 20 (GDELT, HTTP 429) n'est pas simplement « dégradée ».
 */
export const FAILING_RATE = 0.1;
export const FAILING_RATE_MIN_SAMPLE = 10;

/** Clé de `getConnectorStatuses()` → source enregistrée dans `source_records`. */
export const CONNECTOR_SOURCE: Record<string, SourceKind | null> = {
  sirene: "sirene",
  bodacc: "bodacc",
  tresor: "tresor_gels",
  sanctions_intl: "sanctions_intl",
  opensanctions: "opensanctions",
  gleif: "gleif",
  ban: "ban",
  gdelt: "gdelt",
  vies: "vies",
  inpi: "inpi",
  pappers: "pappers",
  recherche_entreprises: "recherche_entreprises",
  balo: "balo",
  boamp: "boamp",
  joafe: "joafe",
  dca: "dca",
  rge: "rge",
  agence_bio: "agence_bio",
  alim_confiance: "alim_confiance",
  qualiopi: "qualiopi",
  georisques: "georisques",
  annuaire_administration: "annuaire_administration",
  camino: "camino",
  hatvp: "hatvp",
  decp: "decp",
  companies_house: "companies_house",
  database: null,
};

export type ObservedState = "operational" | "degraded" | "failing" | "no_data";

export type ObservedHealth = {
  state: ObservedState;
  /** Pourquoi « en échec » : série d'échecs en cours, ou taux de réussite quasi nul. */
  failingReason: "streak" | "rate" | null;
  /** Consultations réelles (hors fixtures) retenues dans la fenêtre. */
  consulted: number;
  /** Dont réussies. */
  ok: number;
  /** Date de la dernière consultation réelle. */
  lastAt: string | null;
  /** Cause de la dernière consultation en échec, si l'état n'est pas « opérationnel ». */
  lastIssue: string | null;
};

export type ConsultationRow = {
  source: string;
  endpoint: string;
  http_status: string | number | null;
  is_fixture: string | boolean | null;
  requested_at: string | Date | null;
};

const iso = (v: string | Date | null): string | null => {
  if (!v) return null;
  const t = new Date(v);
  return Number.isFinite(t.getTime()) ? t.toISOString() : null;
};

const statusOf = (row: ConsultationRow): number => {
  const n = Number(row.http_status);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Échec = erreur HTTP ou consultation dégradée (comme `getSourceHealth`), SAUF
 * « introuvable » (HTTP 404) : la source a répondu, l'absence est une réponse
 * (Companies House pour un numéro inconnu, Pappers pour un SIREN qu'il ne
 * référence pas). Sans cette exception, des absences légitimes répétées
 * feraient passer un connecteur sain « en échec » et déclareraient peu fiables
 * ses « aucune correspondance ».
 */
export const isFailedConsultation = (row: ConsultationRow): boolean => {
  const status = statusOf(row);
  if (status === 404) return false;
  return status >= 400 || isDegradedEndpoint(row.endpoint);
};

/** « HTTP 402 » ou le marqueur de dégradation de l'endpoint (« exception », « erreur 429 »…). */
export function issueOf(row: ConsultationRow): string {
  const status = statusOf(row);
  if (status >= 400) return `HTTP ${status}`;
  const marker = /\(([^()]+)\)\s*$/.exec(row.endpoint);
  return marker ? marker[1] : "consultation dégradée";
}

const isFixture = (row: ConsultationRow) => row.is_fixture === true || row.is_fixture === "true";

/**
 * Une consultation réelle a un endpoint HTTP(S) ou une lecture d'import (`db:`).
 * Les autres endpoints enregistrés sont des sentinelles qui n'ont contacté aucune
 * source (`ban:requete-vide`, `qualiopi:siren-invalide`, `vies:siren-non-derivable:…`) :
 * les compter ferait paraître « opérationnelle » une source jamais interrogée.
 */
const isRealCall = (row: ConsultationRow) => /^(?:https?:\/\/|db:)/i.test(row.endpoint);

/** Pure : regroupe les consultations réelles par source et en déduit l'état observé. */
export function observeConnectors(rows: ConsultationRow[]): Map<string, ObservedHealth> {
  const bySource = new Map<string, ConsultationRow[]>();
  for (const row of rows) {
    if (isFixture(row) || !isRealCall(row)) continue;
    const list = bySource.get(row.source) ?? [];
    list.push(row);
    bySource.set(row.source, list);
  }
  const out = new Map<string, ObservedHealth>();
  for (const [source, all] of bySource) {
    const list = all
      .map((r) => ({ r, at: iso(r.requested_at) }))
      .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
      .slice(0, HEALTH_SAMPLE);
    const failures = list.filter(({ r }) => isFailedConsultation(r));
    // « En échec » exige une SÉRIE complète : un connecteur tout juste configuré
    // dont une ou deux consultations ont échoué reste « dégradé ».
    const recent = list.slice(0, FAILING_STREAK);
    const streak =
      recent.length === FAILING_STREAK && recent.every(({ r }) => isFailedConsultation(r));
    const ok = list.length - failures.length;
    const rate =
      !streak && list.length >= FAILING_RATE_MIN_SAMPLE && ok / list.length <= FAILING_RATE;
    const failing = streak || rate;
    out.set(source, {
      state: failing ? "failing" : failures.length > 0 ? "degraded" : "operational",
      failingReason: streak ? "streak" : rate ? "rate" : null,
      consulted: list.length,
      ok: list.length - failures.length,
      lastAt: list[0]?.at ?? null,
      lastIssue: failures[0] ? issueOf(failures[0].r) : null,
    });
  }
  return out;
}

export const NO_DATA: ObservedHealth = {
  state: "no_data", failingReason: null, consulted: 0, ok: 0, lastAt: null, lastIssue: null,
};

/**
 * Lit les dernières consultations réelles. `null` = base indisponible (jamais un
 * « opérationnel » inventé) ; sans DATABASE_URL, `null` également.
 */
export async function getConnectorHealth(): Promise<Map<string, ObservedHealth> | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const result = await getDb().execute(sql`
      select source::text as source, endpoint, http_status, is_fixture, requested_at
      from (
        select source, endpoint, http_status, is_fixture, requested_at,
               row_number() over (partition by source order by requested_at desc) as rn
        from source_records
        where requested_at > now() - make_interval(days => ${HEALTH_WINDOW_DAYS})
          and is_fixture = 'false'
      ) t
      where rn <= ${HEALTH_SAMPLE}
    `);
    return observeConnectors(result.rows as ConsultationRow[]);
  } catch {
    return null;
  }
}
