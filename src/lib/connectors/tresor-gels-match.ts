import { jaroWinkler } from "@/lib/match/similarity";
import { normalizeName, stripLegalForms } from "@/lib/match/normalize";

/**
 * Rapprochement dénomination ↔ Registre national des gels (DG Trésor).
 *
 * Module PUR (aucune E/S) : le connecteur télécharge la publication, ce module
 * en extrait les entrées utiles puis ne renvoie que les correspondances — jamais
 * le fichier complet (> 10 Mo), qui ne doit pas être persisté dans source_records.
 *
 * ⚠️ Le schéma exact du flux JSON n'est pas documenté publiquement dans le
 * dépôt : l'extraction est TOLÉRANTE (casse des clés) et, si aucune entrée n'est
 * reconnue, elle le dit (`schema_inconnu`) au lieu de conclure à l'absence de
 * correspondance. Une absence de résultat ≠ un screening non effectué.
 */

export type GelsEntry = {
  nom: string;
  nature: string | null;
  aliases: string[];
};

export type GelsExtraction = {
  status: "ok" | "schema_inconnu";
  publicationDate: string | null;
  entries: GelsEntry[];
};

/** Forme consommée par `normalizeGels` (inchangée : matchType exact → declared). */
export type GelsMatch = {
  nom: string;
  type: string;
  matchType: "exact" | "approximatif";
  registre: string;
  score: number;
};

export const GELS_REGISTRE = "Gels des avoirs (DG Trésor)";
/** Similarité minimale pour une correspondance approximative. */
export const GELS_APPROX_THRESHOLD = 0.93;
/** En dessous, une dénomination est trop courte pour un rapprochement approximatif. */
const MIN_APPROX_LENGTH = 6;
/** Borne le bruit : on ne remonte jamais plus de 5 candidats par dossier. */
const MAX_MATCHES = 5;
/**
 * Part minimale des mots de la dénomination la plus longue qui doivent avoir un
 * équivalent dans l'autre. Écarte l'inclusion : « DANONE » ne ressemble pas à
 * « DANONE INTERNATIONAL » (1 mot sur 2), alors qu'une simple variante
 * d'orthographe (holding / holdings) reste rapprochée.
 */
const MIN_TOKEN_COVERAGE = 0.6;
/** Deux mots sont « équivalents » (pluriel, faute de frappe) au-dessus de ce seuil. */
const TOKEN_EQUIVALENCE = 0.9;

/**
 * Part des mots (de la dénomination la plus longue) ayant un équivalent dans
 * l'autre. Symétrique, contrairement à un score d'inclusion.
 */
function tokenCoverage(a: string, b: string): number {
  const ta = a.split(" ").filter(Boolean);
  const tb = b.split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const matched = short.filter((t) =>
    long.some((u) => t === u || jaroWinkler(t, u) >= TOKEN_EQUIVALENCE),
  ).length;
  return matched / long.length;
}

/** Lecture d'une clé sans tenir compte de la casse (`Nom` / `nom` / `NOM`). */
function pick(obj: unknown, ...names: string[]): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (wanted.has(key.toLowerCase())) return value;
  }
  return undefined;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectAliases(entry: unknown): string[] {
  const detail = pick(entry, "RegistreDetail");
  if (!Array.isArray(detail)) return [];
  const aliases: string[] = [];
  for (const field of detail) {
    const type = asText(pick(field, "TypeChamp"));
    if (!type || normalizeName(type) !== "alias") continue;
    const values = pick(field, "Valeur");
    for (const value of Array.isArray(values) ? values : [values]) {
      const text = asText(value) ?? asText(pick(value, "Alias"));
      if (text) aliases.push(text);
    }
  }
  return aliases;
}

function locateDetails(
  publication: unknown,
): { details: unknown[]; date: string | null } | null {
  if (Array.isArray(publication)) {
    return publication.length > 0 ? { details: publication, date: null } : null;
  }
  const container = pick(publication, "Publications", "Publication") ?? publication;
  const roots = Array.isArray(container) ? container : [container];
  const details = roots.flatMap((root) => {
    const found = pick(root, "PublicationDetail", "PublicationDetails");
    return Array.isArray(found) ? found : [];
  });
  if (details.length === 0) return null;
  const date = asText(pick(roots[0], "DatePublication"));
  return { details, date };
}

/** Réduit la publication aux champs utiles (nom, nature, alias). Ne lève jamais. */
export function extractGelsEntries(publication: unknown): GelsExtraction {
  const located = locateDetails(publication);
  const entries: GelsEntry[] = [];
  for (const raw of located?.details ?? []) {
    const nom = asText(pick(raw, "Nom"));
    if (!nom) continue;
    entries.push({
      nom,
      nature: asText(pick(raw, "Nature")),
      aliases: collectAliases(raw),
    });
  }
  if (entries.length === 0) {
    return { status: "schema_inconnu", publicationDate: located?.date ?? null, entries: [] };
  }
  return { status: "ok", publicationDate: located?.date ?? null, entries };
}

function isNaturalPerson(nature: string | null): boolean {
  return normalizeName(nature ?? "").includes("physique");
}

/**
 * Compare la dénomination du sujet à chaque entrée (nom + alias).
 *  - égalité après normalisation (accents, ponctuation, formes juridiques) → « exact » ;
 *  - similarité ≥ seuil, dénominations assez longues → « approximatif ».
 * Les personnes physiques sont écartées : un sujet société ne se rapproche pas
 * d'un individu. Résultat = HYPOTHÈSE à vérifier, jamais un fait.
 */
export function matchGelsEntries(
  entries: GelsEntry[],
  query: { name?: string | null },
): GelsMatch[] {
  const name = query.name?.trim();
  if (!name) return [];
  const target = stripLegalForms(name);
  if (!target) return [];

  const matches: GelsMatch[] = [];
  for (const entry of entries) {
    if (isNaturalPerson(entry.nature)) continue;
    let best: { score: number; exact: boolean } | null = null;
    for (const candidate of [entry.nom, ...entry.aliases]) {
      const stripped = stripLegalForms(candidate);
      if (!stripped) continue;
      if (stripped === target) {
        best = { score: 1, exact: true };
        break;
      }
      if (target.length < MIN_APPROX_LENGTH || stripped.length < MIN_APPROX_LENGTH) {
        continue;
      }
      // Jaro-Winkler sur la chaîne COMPLÈTE (pas de score d'inclusion de mots) ET
      // couverture des mots : « DANONE » ≠ « DANONE INTERNATIONAL HOLDING ».
      const score = jaroWinkler(target, stripped);
      if (
        score >= GELS_APPROX_THRESHOLD &&
        tokenCoverage(target, stripped) >= MIN_TOKEN_COVERAGE &&
        (!best || score > best.score)
      ) {
        best = { score, exact: false };
      }
    }
    if (best) {
      matches.push({
        nom: entry.nom,
        type: entry.nature ?? "Entité",
        matchType: best.exact ? "exact" : "approximatif",
        registre: GELS_REGISTRE,
        score: Math.round(best.score * 100) / 100,
      });
    }
  }

  return matches
    .sort((a, b) =>
      a.matchType === b.matchType ? b.score - a.score : a.matchType === "exact" ? -1 : 1,
    )
    .slice(0, MAX_MATCHES);
}
