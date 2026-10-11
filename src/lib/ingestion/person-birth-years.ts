import type { CaseEntity } from "@/lib/graph/graph-types";
import { personTokens } from "@/lib/connectors/sanctions-lists";
import type { PersonQuery } from "@/lib/connectors/sanctions-persons-match";
import { displayName } from "./normalize-companies-house";

/**
 * Années de naissance des dirigeants, relues dans les charges brutes des sources
 * (Recherche d'entreprises / RNE, Pappers, Companies House). Elles servent
 * UNIQUEMENT à départager un homonyme lors du contrôle des listes de sanctions :
 * jamais le mois ni la date, jamais ajoutées à une fiche ni affichées.
 */
export const personNameKey = (name: string): string =>
  [...new Set(personTokens(name))].sort().join(" ");

const year = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number((/(18[89]\d|19\d{2}|200\d|201[0-5])/.exec(v) ?? [])[1]) : NaN;
  return Number.isInteger(n) && n >= 1880 && n <= 2015 ? n : null;
};
const asObj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const asList = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.map(asObj).filter((x): x is Record<string, unknown> => x !== null) : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export type BirthYearSources = {
  /** Charge brute de Recherche d'entreprises (`RechercheEntreprisesRaw`). */
  recherche?: unknown;
  /** Charge brute de Pappers (`PappersResult`). */
  pappers?: unknown;
  /** Charges brutes de Companies House (`CompaniesHouseRaw`), une par société mère. */
  companiesHouse?: unknown[];
};

/** Nom (jeu de mots trié) → années de naissance publiées, toutes sources confondues. */
export function collectBirthYears(sources: BirthYearSources): Map<string, number[]> {
  const out = new Map<string, Set<number>>();
  const add = (name: string, y: number | null) => {
    if (y === null) return;
    const key = personNameKey(name);
    if (!key) return;
    const set = out.get(key) ?? new Set<number>();
    set.add(y);
    out.set(key, set);
  };

  for (const d of asList(asObj(sources.recherche)?.dirigeants)) {
    if (text(d.type) === "personne morale") continue;
    add([text(d.prenoms), text(d.nom)].filter(Boolean).join(" "), year(d.anneeNaissance));
  }

  const pappers = asObj(sources.pappers);
  for (const p of [...asList(pappers?.dirigeants), ...asList(pappers?.representants)]) {
    if (p.personne_morale === true) continue;
    const name = text(p.nom_complet) || [text(p.prenom), text(p.nom)].filter(Boolean).join(" ");
    add(name, year(p.date_de_naissance_formate));
  }
  for (const b of asList(pappers?.beneficiaires_effectifs)) {
    add([text(b.prenom), text(b.nom)].filter(Boolean).join(" "), year(b.date_de_naissance_formate));
  }

  for (const raw of sources.companiesHouse ?? []) {
    const ch = asObj(raw);
    for (const o of [...asList(ch?.officers), ...asList(ch?.pscs)]) {
      if (o.corporate === true) continue;
      // Même nom d'affichage que le graphe (« BRANCH, Sonya Judith Clara, Ms. » → sans
      // titre) : sinon l'année est indexée sous une clé que la personne n'a pas.
      add(displayName(text(o.name), false), year(o.birthYear));
    }
  }

  return new Map([...out].map(([k, v]) => [k, [...v].sort()]));
}

/** Personnes physiques du dossier (avant résolution), avec leurs années de naissance connues. */
export function buildPersonQueries(
  entities: readonly CaseEntity[],
  years: ReadonlyMap<string, number[]>,
): PersonQuery[] {
  const seen = new Set<string>();
  const out: PersonQuery[] = [];
  for (const e of entities) {
    if (e.type !== "person" || seen.has(e.id) || !e.label.trim()) continue;
    seen.add(e.id);
    out.push({ key: e.id, name: e.label, birthYears: years.get(personNameKey(e.label)) ?? [] });
  }
  return out;
}
