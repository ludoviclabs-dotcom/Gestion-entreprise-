import { personTokens } from "./sanctions-lists";

/**
 * Rapprochement d'une PERSONNE (dirigeant, bénéficiaire) avec les listes de
 * sanctions internationales. Module pur.
 *
 * Doctrine — un nom de personne est une HYPOTHÈSE, jamais un fait : les homonymes
 * sont la règle (« Mohamed Ali », « Jean Martin »). Un nom, même identique, ne
 * suffit donc jamais à alimenter le graphe :
 *  - nom identique (ou inclus) ET année de naissance concordante → « corroborée »
 *    (retenue dans le graphe, donc dans les signaux, en niveau « simulé ») ;
 *  - nom identique mais année inconnue d'un côté, ou voisine (± 1 an) → « à
 *    vérifier » (attribut seulement, aucun nœud ni signal) ;
 *  - année de naissance connue des deux côtés et différente → écartée (comptée).
 * Aucun rapprochement approximatif (translittérations, fautes) : le rappel est
 * volontairement sacrifié à la précision — un nom proche n'est pas un nom identique.
 */
export type PersonQuery = {
  /** Identifiant du nœud personne interrogé (clé de retour). */
  key: string;
  name: string;
  /** Années de naissance publiées pour cette personne (le plus souvent une seule). */
  birthYears: number[];
};

export type PersonEntry = {
  nom: string;
  aliases: string[];
  birthYears: number[];
};

export type PersonNameMatch = "exact" | "inclus";
export type BirthCheck = "corroborated" | "unknown" | "near";

export type ScoredPerson<E extends PersonEntry> = {
  entry: E;
  /** Nom (principal ou alias) rapproché. */
  matchedName: string;
  name: PersonNameMatch;
  birth: BirthCheck;
};

/** Au-delà de ce nombre d'années listées, la naissance n'est plus un indice. */
export const MAX_CORROBORATING_YEARS = 3;

const nameMatch = (query: string[], candidate: string[]): PersonNameMatch | null => {
  if (query.length < 2 || candidate.length < 2) return null;
  const q = new Set(query);
  const c = new Set(candidate);
  const [small, large] = q.size <= c.size ? [q, c] : [c, q];
  if (small.size < 2) return null;
  for (const t of small) if (!large.has(t)) return null;
  return small.size === large.size ? "exact" : "inclus";
};

export function checkBirth(
  queryYears: readonly number[],
  entryYears: readonly number[],
): BirthCheck | "excluded" {
  if (queryYears.length === 0 || entryYears.length === 0) return "unknown";
  if (queryYears.some((y) => entryYears.includes(y))) {
    // Une plage de dates trop large (« dd/mm/1945 » … « dd/mm/1958 ») ne corrobore rien.
    return entryYears.length <= MAX_CORROBORATING_YEARS ? "corroborated" : "unknown";
  }
  if (queryYears.some((y) => entryYears.some((e) => Math.abs(e - y) === 1))) return "near";
  return "excluded";
}

export type PersonMatchOutcome<E extends PersonEntry> = {
  matches: ScoredPerson<E>[];
  /** Entrées de même nom écartées parce que l'année de naissance diffère. */
  excluded: number;
};

export function matchPersonEntries<E extends PersonEntry>(
  entries: readonly E[],
  query: { name: string; birthYears: readonly number[] },
): PersonMatchOutcome<E> {
  const q = personTokens(query.name);
  const matches: ScoredPerson<E>[] = [];
  let excluded = 0;
  for (const entry of entries) {
    let best: { name: PersonNameMatch; matched: string } | null = null;
    for (const candidate of [entry.nom, ...entry.aliases]) {
      const m = nameMatch(q, personTokens(candidate));
      if (!m) continue;
      if (!best || (m === "exact" && best.name === "inclus")) best = { name: m, matched: candidate };
      if (best.name === "exact") break;
    }
    if (!best) continue;
    const birth = checkBirth(query.birthYears, entry.birthYears);
    if (birth === "excluded") {
      excluded++;
      continue;
    }
    matches.push({ entry, matchedName: best.matched, name: best.name, birth });
  }
  // Corroborées d'abord, puis nom identique avant nom inclus.
  const rank = (m: ScoredPerson<E>) =>
    (m.birth === "corroborated" ? 0 : 2) + (m.name === "exact" ? 0 : 1);
  matches.sort((a, b) => rank(a) - rank(b));
  return { matches, excluded };
}
