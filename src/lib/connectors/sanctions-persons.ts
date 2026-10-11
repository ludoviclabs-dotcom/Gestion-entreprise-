import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { isDemoMode, isSanctionsIntlEnabled, isSanctionsPersonsEnabled } from "@/lib/env";
import {
  matchPersonEntries,
  type BirthCheck,
  type PersonMatchOutcome,
  type PersonNameMatch,
  type PersonQuery,
} from "./sanctions-persons-match";
import {
  SANCTION_IMPORT_SOURCES,
  SANCTION_LIST_KEYS,
  SANCTION_LIST_LABELS,
  SANCTIONS_PERSONS_PROJECTION_VERSION,
  personKeys,
  requiredKeyOverlap,
  type SanctionListKey,
} from "./sanctions-lists";
import { SANCTIONS_MAX_AGE_MS, type SanctionListState } from "./sanctions-intl";
import type { ConnectorResult } from "./types";

/**
 * Contrôle des PERSONNES (dirigeants, bénéficiaires du dossier) contre les listes de
 * sanctions internationales importées (`sanctions_entries`, `kind = 'person'`).
 *
 * Mêmes garde-fous que le contrôle des sociétés :
 *  - la réponse dit, liste par liste, ce qui a été consulté ; une liste absente, non
 *    importée avec les personnes (version < v3) ou vérifiée il y a plus de 72 h
 *    rend le contrôle PARTIEL — jamais un « aucune correspondance » inventé ;
 *  - ne lève jamais ; panne → statut « indisponible ».
 * Précision avant rappel : voir `sanctions-persons-match.ts`.
 */
export const MAX_PERSONS = 40;
/** Candidates lues par (personne, liste) avant rapprochement fin. */
const CANDIDATES_PER_PERSON = 200;
/** Correspondances rapportées par personne. */
const MAX_MATCHES_PER_PERSON = 5;

export type PersonMatch = {
  queryKey: string;
  queryName: string;
  list: SanctionListKey;
  listLabel: string;
  sublist: string | null;
  nom: string;
  matchedName: string;
  name: PersonNameMatch;
  birth: BirthCheck;
  /** Années de naissance listées (jamais la date complète). */
  birthYears: number[];
  programs: string[];
  countries: string[];
  listedOn: string | null;
  entryKey: string;
};

export type SanctionsPersonsRaw = {
  status: "ok" | "partiel" | "non_importe" | "indisponible";
  lists: SanctionListState[];
  /** Personnes contrôlées (≤ MAX_PERSONS) et personnes du dossier non contrôlées. */
  queried: number;
  notQueried: number;
  /** Parmi les contrôlées : années de naissance connues. */
  withBirthYear: number;
  matches: PersonMatch[];
  /** Entrées de même nom écartées parce que l'année de naissance diffère. */
  excluded: number;
  truncated: boolean;
};

const iso = (v: unknown): string | null => {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const parseJson = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const strings = (v: unknown): string[] => {
  const parsed = parseJson(v);
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
};
const numbers = (v: unknown): number[] => {
  const parsed = parseJson(v);
  return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === "number" && Number.isFinite(x)) : [];
};
const day = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
};
const listOfSource = (source: string): SanctionListKey | null =>
  SANCTION_LIST_KEYS.find((k) => SANCTION_IMPORT_SOURCES[k] === source) ?? null;

type Row = Record<string, unknown>;

export const sanctionsPersons = {
  async match(people: PersonQuery[], now: number = Date.now()): Promise<ConnectorResult<unknown>> {
    const endpoint = "db:sanctions_entries";
    const empty = (status: SanctionsPersonsRaw["status"]): SanctionsPersonsRaw => ({
      status, lists: [], queried: 0, notQueried: 0, withBirthYear: 0, matches: [], excluded: 0, truncated: false,
    });
    if (isDemoMode() || !isSanctionsIntlEnabled() || !isSanctionsPersonsEnabled()) {
      return { raw: empty("indisponible"), endpoint: "fixture:sanctions-persons", httpStatus: 0, isFixture: true };
    }
    const failed = (status: SanctionsPersonsRaw["status"], suffix: string): ConnectorResult<unknown> => ({
      raw: empty(status), endpoint: `${endpoint} (${suffix})`, httpStatus: 503, isFixture: false,
    });

    // Personnes à nom complet seulement (au moins deux mots) ; celles dont l'année est
    // connue d'abord, car ce sont les seules qui peuvent être corroborées.
    const eligible = people
      .map((p) => ({ ...p, keys: personKeys([p.name]) }))
      .filter((p) => p.keys.length >= 2)
      .sort((a, b) => Number(b.birthYears.length > 0) - Number(a.birthYears.length > 0));
    const named = eligible.slice(0, MAX_PERSONS);
    const notQueried = people.length - named.length;
    const withBirthYear = named.filter((p) => p.birthYears.length > 0).length;
    const sources = SANCTION_LIST_KEYS.map((k) => SANCTION_IMPORT_SOURCES[k]);

    try {
      const queries = named.map((p, i) => ({
        pid: String(i), keys: p.keys, need: requiredKeyOverlap(p.keys),
      }));
      const result = await getDb().execute(sql`
        with latest as (
          select distinct on (source) id, source, version, imported_at, checked_at, record_count
          from open_data_imports
          where source in (${sql.join(sources.map((s) => sql`${s}`), sql`, `)}) and status = 'ok'
          order by source, imported_at desc
        ), q as (
          select pid, keys, need
          from jsonb_to_recordset(${JSON.stringify(queries)}::jsonb) as x(pid text, keys jsonb, need int)
        )
        select l.source, l.version, l.imported_at, l.checked_at, l.record_count,
               e.pid, e.entry_key, e.sublist, e.name, e.aliases, e.programs,
               e.countries, e.listed_on, e.birth_years
        from latest l
        left join lateral (
          select q.pid, s.entry_key, s.sublist, s.name, s.aliases, s.programs,
                 s.countries, s.listed_on, s.birth_years
          from q
          cross join lateral (
            -- Les entrées partageant le plus de clés d'abord : pour un nom très courant,
            -- la limite écarte les voisines éloignées, pas la correspondance complète.
            select c.* from (
              select s0.*,
                     (select count(*) from jsonb_array_elements_text(s0.keys) kk(v)
                      where kk.v in (select jsonb_array_elements_text(q.keys))) as overlap
              from sanctions_entries s0
              where s0.import_id = l.id
                and s0.kind = 'person'
                and l.version = ${SANCTIONS_PERSONS_PROJECTION_VERSION}
                and s0.keys ?| array(select jsonb_array_elements_text(q.keys))
            ) c
            where c.overlap >= q.need
            order by c.overlap desc, c.entry_key
            limit ${CANDIDATES_PER_PERSON}
          ) s
        ) e on true
        order by l.source, e.pid, e.entry_key
      `);
      const rows = result.rows as Row[];
      if (rows.length === 0) return failed("non_importe", "source non importée");

      const lists = new Map<SanctionListKey, SanctionListState>();
      const byPerson = new Map<string, { list: SanctionListKey; row: Row }[]>();
      let truncated = false;
      const perPersonList = new Map<string, number>();
      for (const r of rows) {
        const list = listOfSource(String(r.source));
        if (!list) continue;
        if (!lists.has(list)) {
          const importedAt = iso(r.imported_at);
          const checkedAt = iso(r.checked_at);
          // Une liste n'est « à jour » pour les personnes que si elle a été importée
          // avec les personnes (v3) ET vérifiée récemment.
          const withPersons = r.version === SANCTIONS_PERSONS_PROJECTION_VERSION;
          const fresh = checkedAt !== null && now - Date.parse(checkedAt) <= SANCTIONS_MAX_AGE_MS;
          lists.set(list, {
            key: list, label: SANCTION_LIST_LABELS[list],
            state: withPersons ? (fresh ? "ok" : "stale") : "missing",
            importedAt, checkedAt, entries: Number(r.record_count) || 0,
          });
        }
        if (r.entry_key === null || r.entry_key === undefined || r.pid === null || r.pid === undefined) continue;
        const pid = String(r.pid);
        const bucket = byPerson.get(pid) ?? [];
        bucket.push({ list, row: r });
        byPerson.set(pid, bucket);
        const k = `${pid}|${list}`;
        const n = (perPersonList.get(k) ?? 0) + 1;
        perPersonList.set(k, n);
        if (n >= CANDIDATES_PER_PERSON) truncated = true;
      }
      for (const key of SANCTION_LIST_KEYS) {
        if (!lists.has(key)) {
          lists.set(key, { key, label: SANCTION_LIST_LABELS[key], state: "missing", importedAt: null, checkedAt: null, entries: 0 });
        }
      }
      const ordered = SANCTION_LIST_KEYS.map((k) => lists.get(k)!);
      // Aucune liste importée avec les personnes : pas de contrôle, jamais « aucune ».
      if (ordered.every((l) => l.state === "missing")) {
        return { ...failed("non_importe", "source non importée"), raw: { ...empty("non_importe"), lists: ordered } };
      }

      const matches: PersonMatch[] = [];
      let excluded = 0;
      named.forEach((person, i) => {
        const bucket = byPerson.get(String(i)) ?? [];
        const entries = bucket.map(({ list, row }) => ({
          nom: String(row.name ?? ""),
          aliases: strings(row.aliases),
          birthYears: numbers(row.birth_years),
          list,
          row,
        }));
        const outcome: PersonMatchOutcome<(typeof entries)[number]> = matchPersonEntries(entries, person);
        excluded += outcome.excluded;
        for (const m of outcome.matches.slice(0, MAX_MATCHES_PER_PERSON)) {
          const r = m.entry.row;
          matches.push({
            queryKey: person.key,
            queryName: person.name,
            list: m.entry.list,
            listLabel: SANCTION_LIST_LABELS[m.entry.list],
            sublist: typeof r.sublist === "string" ? r.sublist : null,
            nom: m.entry.nom,
            matchedName: m.matchedName,
            name: m.name,
            birth: m.birth,
            birthYears: m.entry.birthYears,
            programs: strings(r.programs),
            countries: strings(r.countries),
            listedOn: day(r.listed_on),
            entryKey: String(r.entry_key),
          });
        }
      });

      const complete = ordered.every((l) => l.state === "ok");
      const raw: SanctionsPersonsRaw = {
        status: complete ? "ok" : "partiel",
        lists: ordered,
        queried: named.length,
        notQueried,
        withBirthYear,
        matches,
        excluded,
        truncated,
      };
      return {
        raw,
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
