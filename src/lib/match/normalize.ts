/**
 * Normalisation de noms pour la résolution d'entités (pur TS, zéro dépendance).
 * Souveraineté par construction : aucune lib externe, exécution locale.
 */

/**
 * Formes juridiques retirées avant comparaison de dénominations. Liste
 * volontairement CONSERVATRICE : uniquement des sigles juridiques non
 * ambigus (FR + quelques internationaux). On EXCLUT les qualificatifs
 * distinctifs (« holding », « group(e) », « compagnie ») et les homographes
 * courts ambigus (« co », « spa », « ag », « nv », « inc »…) qui sont des mots
 * porteurs de sens — les retirer rapprocherait à tort des entités distinctes.
 */
const LEGAL_FORMS = new Set([
  "sa", "sarl", "sas", "sasu", "eurl", "sci", "snc", "selarl", "selas", "sca",
  "scea", "earl", "gaec", "gie", "sccv", "scp", "scm", "sep", "sdc", "ets",
  "etablissements", "gmbh", "ltd", "llc", "plc", "srl",
]);

/**
 * Translittération des lettres latines NON décomposables par NFD (lettres à
 * trait/barre, ligatures). Sans cela, ces caractères tomberaient hors [a-z0-9]
 * et seraient SUPPRIMÉS (perte de recall sur les noms d'Europe centrale/du Nord
 * — fréquents dans les listes de sanctions). Appliquée après NFD + minuscule.
 */
const TRANSLIT: Record<string, string> = {
  ß: "ss", ø: "o", ł: "l", đ: "d", æ: "ae", œ: "oe", þ: "th", ð: "d",
  ŋ: "ng", ħ: "h", ı: "i", ŧ: "t", ſ: "s",
};

function transliterate(s: string): string {
  return s.replace(/[ßøłđæœþðŋħıŧſ]/g, (c) => TRANSLIT[c] ?? c);
}

/**
 * Minuscule, sans accents (y compris lettres à barre via translittération),
 * ponctuation des sigles supprimée (S.A.R.L. → sarl ; L'Oréal → loreal),
 * autres séparateurs → espace, espaces compactés.
 */
export function normalizeName(input: string): string {
  return transliterate(
    input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
  )
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Retire les formes juridiques d'une dénomination normalisée. Si tous les
 * tokens sont des formes (cas dégénéré), renvoie la dénomination normalisée
 * complète plutôt que la chaîne vide.
 */
export function stripLegalForms(input: string): string {
  const tokens = normalizeName(input).split(" ").filter(Boolean);
  const kept = tokens.filter((t) => !LEGAL_FORMS.has(t));
  return (kept.length > 0 ? kept : tokens).join(" ");
}

/** Tokens normalisés d'un nom de personne (prénoms puis nom). */
export function personTokens(nom?: string, prenoms?: string): string[] {
  const full = [prenoms, nom].filter(Boolean).join(" ");
  return normalizeName(full).split(" ").filter(Boolean);
}
