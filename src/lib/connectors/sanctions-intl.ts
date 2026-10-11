import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isDemoMode, isSanctionsIntlEnabled } from "@/lib/env";
import { matchEntries } from "./tresor-gels-match";
import {
  SANCTION_IMPORT_SOURCES,
  SANCTION_LIST_KEYS,
  SANCTION_LIST_LABELS,
  requiredKeyOverlap,
  sanctionKeys,
  type SanctionEntryKind,
  type SanctionListKey,
} from "./sanctions-lists";
import type { ConnectorResult } from "./types";

/**
 * Listes de sanctions et de contrôle internationales (hors UE) : lecture de
 * l'import quotidien en base (`sanctions_entries`) puis rapprochement par
 * dénomination — le MÊME algorithme que le registre national des gels.
 *
 * Garde-fous propres à un contrôle de sanctions :
 *  - la réponse dit, liste par liste, ce qui a été consulté (date d'import et de
 *    dernière vérification) : un « aucune correspondance » n'est jamais présenté
 *    sans la liste des listes qui l'étayent ;
 *  - liste absente ou vérifiée il y a plus de 72 h → consultation PARTIELLE
 *    (endpoint suffixé, comptée en échec, jamais une couverture complète) ; les
 *    correspondances des listes disponibles restent rapportées ;
 *  - aucun import validé → « source non importée », jamais « aucune présence » ;
 *  - ne lève jamais.
 */
export const SANCTIONS_MAX_AGE_MS = 72 * 60 * 60 * 1000;
/** Candidates lues par liste (pré-filtre par clés) ; au-delà : couverture dite tronquée. */
const CANDIDATES_PER_LIST = 1500;
/** Correspondances rapportées par dossier (toutes listes et sujets confondus). */
const MAX_MATCHES = 12;
const MAX_QUERIES = 4;

export type SanctionQuery = { key: string; name: string };

export type SanctionListState = {
  key: SanctionListKey;
  label: string;
  state: "ok" | "stale" | "missing";
  importedAt: string | null;
  checkedAt: string | null;
  entries: number;
};

export type SanctionMatch = {
  queryKey: string;
  queryName: string;
  list: SanctionListKey;
  listLabel: string;
  sublist: string | null;
  nom: string;
  /** Nom (principal ou alias) de l'entrée réellement rapproché du nom interrogé. */
  matchedName: string;
  matchType: "exact" | "approximatif";
  score: number;
  kind: SanctionEntryKind;
  programs: string[];
  countries: string[];
  listedOn: string | null;
  entryKey: string;
};

export type SanctionsIntlRaw = {
  status: "ok" | "partiel" | "non_importe" | "indisponible";
  lists: SanctionListState[];
  queries: SanctionQuery[];
  matches: SanctionMatch[];
  truncated: boolean;
};

const iso = (v: unknown): string | null => {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const strings = (v: unknown): string[] => {
  const parsed = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
};
const day = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
};
const listOfSource = (source: string): SanctionListKey | null =>
  SANCTION_LIST_KEYS.find((k) => SANCTION_IMPORT_SOURCES[k] === source) ?? null;

type Row = Record<string, unknown>;

export const sanctionsIntl = {
  async match(
    queries: SanctionQuery[],
    now: number = Date.now(),
  ): Promise<ConnectorResult<unknown>> {
    const endpoint = "db:sanctions_entries";
    const empty = (status: SanctionsIntlRaw["status"]): SanctionsIntlRaw => ({
      status, lists: [], queries: [], matches: [], truncated: false,
    });
    if (isDemoMode() || !isSanctionsIntlEnabled()) {
      return { raw: empty("indisponible"), endpoint: "fixture:sanctions-intl", httpStatus: 0, isFixture: true };
    }
    const failed = (status: SanctionsIntlRaw["status"], suffix: string): ConnectorResult<unknown> => ({
      raw: empty(status), endpoint: `${endpoint} (${suffix})`, httpStatus: 503, isFixture: false,
    });

    const named = queries
      .map((q) => ({ key: q.key, name: q.name.trim() }))
      .filter((q) => q.name)
      .slice(0, MAX_QUERIES);
    const keys = sanctionKeys(named.map((q) => q.name));
    const need = requiredKeyOverlap(keys);
    const sources = SANCTION_LIST_KEYS.map((k) => SANCTION_IMPORT_SOURCES[k]);

    try {
      // UNE requête : en-tête de chaque import + ses candidates = snapshot cohérent.
      const result = await getDb().execute(sql`
        with latest as (
          select distinct on (source) id, source, imported_at, checked_at, record_count
          from open_data_imports
          where source in (${sql.join(sources.map((s) => sql`${s}`), sql`, `)}) and status = 'ok'
          order by source, imported_at desc
        ), q as (
          select jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb) as k
        )
        select l.source, l.imported_at, l.checked_at, l.record_count,
               e.entry_key, e.list_key, e.sublist, e.name, e.aliases, e.programs,
               e.countries, e.listed_on, e.kind
        from latest l
        left join lateral (
          select s.* from (
            -- Lignes écrites avant la v2 : colonne jsonb contenant une chaîne JSON.
            select s0.*,
                   case when jsonb_typeof(s0.keys) = 'string' then (s0.keys #>> '{}')::jsonb
                        else s0.keys end as key_array
            from sanctions_entries s0
            where s0.import_id = l.id
              -- Les personnes physiques (v3) ont leur propre contrôle (sanctions-persons).
              and s0.kind <> 'person'
          ) s
          where s.key_array ?| array(select k from q)
            and (select count(*) from jsonb_array_elements_text(s.key_array) kk(v)
                 where kk.v in (select k from q)) >= ${need}
          limit ${CANDIDATES_PER_LIST}
        ) e on true
        order by l.source, e.entry_key
      `);
      const rows = result.rows as Row[];
      if (rows.length === 0) return failed("non_importe", "source non importée");

      const lists = new Map<SanctionListKey, SanctionListState>();
      const candidates = new Map<SanctionListKey, Row[]>();
      for (const r of rows) {
        const key = listOfSource(String(r.source));
        if (!key) continue;
        if (!lists.has(key)) {
          const importedAt = iso(r.imported_at);
          const checkedAt = iso(r.checked_at);
          const fresh = checkedAt !== null && now - Date.parse(checkedAt) <= SANCTIONS_MAX_AGE_MS;
          lists.set(key, {
            key, label: SANCTION_LIST_LABELS[key], state: fresh ? "ok" : "stale",
            importedAt, checkedAt, entries: Number(r.record_count) || 0,
          });
          candidates.set(key, []);
        }
        if (r.entry_key !== null && r.entry_key !== undefined) candidates.get(key)!.push(r);
      }
      for (const key of SANCTION_LIST_KEYS) {
        if (!lists.has(key)) {
          lists.set(key, { key, label: SANCTION_LIST_LABELS[key], state: "missing", importedAt: null, checkedAt: null, entries: 0 });
        }
      }
      const truncated = [...candidates.values()].some((rs) => rs.length >= CANDIDATES_PER_LIST);

      type Entry = {
        nom: string; nature: string | null; aliases: string[];
        list: SanctionListKey; row: Row;
      };
      const entries: Entry[] = [];
      for (const [list, rs] of candidates) {
        for (const r of rs) {
          const name = typeof r.name === "string" ? r.name : "";
          if (!name || r.kind === "person") continue;
          entries.push({
            nom: name,
            // Nature « personne physique » écartée par le rapprochement ; les
            // organisations et les types non précisés restent candidats.
            nature: r.kind === "entity" ? "Entité" : null,
            aliases: strings(r.aliases),
            list,
            row: r,
          });
        }
      }

      const matches: SanctionMatch[] = [];
      for (const q of named) {
        for (const m of matchEntries(entries, { name: q.name }, MAX_MATCHES)) {
          const r = m.entry.row;
          matches.push({
            queryKey: q.key,
            queryName: q.name,
            list: m.entry.list,
            listLabel: SANCTION_LIST_LABELS[m.entry.list],
            sublist: typeof r.sublist === "string" ? r.sublist : null,
            nom: m.entry.nom,
            matchedName: m.matchedName,
            matchType: m.matchType,
            score: m.score,
            kind: r.kind === "entity" ? "entity" : "unknown",
            programs: strings(r.programs),
            countries: strings(r.countries),
            listedOn: day(r.listed_on),
            entryKey: String(r.entry_key),
          });
        }
      }
      matches.sort((a, b) =>
        a.matchType === b.matchType ? b.score - a.score : a.matchType === "exact" ? -1 : 1,
      );

      const ordered = SANCTION_LIST_KEYS.map((k) => lists.get(k)!);
      const complete = ordered.every((l) => l.state === "ok");
      const raw: SanctionsIntlRaw = {
        status: complete ? "ok" : "partiel",
        lists: ordered,
        queries: named,
        matches: matches.slice(0, MAX_MATCHES),
        truncated,
      };
      return {
        raw,
        // Couverture partielle : consultation dégradée (comptée en échec, jamais une
        // couverture complète) — les correspondances restent exploitées.
        endpoint: complete ? endpoint : `${endpoint} (listes partielles)`,
        httpStatus: 200,
        isFixture: false,
      };
    } catch (error) {
      Sentry.captureException(error);
      return failed("indisponible", "exception");
    }
  },
};
