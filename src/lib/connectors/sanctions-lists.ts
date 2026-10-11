import { stripLegalForms } from "@/lib/match/normalize";

/**
 * Listes de sanctions et de contrôle INTERNATIONALES (hors UE), importées chaque
 * jour en base (`sanctions_entries`) puis rapprochées par dénomination.
 *
 * Module PUR, partagé par le script d'import (GitHub Actions) et le connecteur
 * (lecture en base). Aucune E/S.
 */
export const SANCTION_LIST_KEYS = ["us", "uk", "un", "ch", "ca"] as const;
export type SanctionListKey = (typeof SANCTION_LIST_KEYS)[number];

/** Clé de `open_data_imports.source` de chaque liste (une transaction par liste). */
export const SANCTION_IMPORT_SOURCES: Record<SanctionListKey, string> = {
  us: "sanctions_us",
  uk: "sanctions_uk",
  un: "sanctions_un",
  ch: "sanctions_ch",
  ca: "sanctions_ca",
};

export const SANCTION_LIST_LABELS: Record<SanctionListKey, string> = {
  us: "États-Unis — liste consolidée (CSL)",
  uk: "Royaume-Uni — UK Sanctions List",
  un: "ONU — liste consolidée du Conseil de sécurité",
  ch: "Suisse — SECO",
  ca: "Canada — mesures spéciales (SEMA)",
};

/** Version de projection : changer les champs retenus force un réimport. */
/**
 * v2 : les colonnes jsonb sont écrites en vrais tableaux JSON. La v1 les écrivait en
 * chaînes JSON (double encodage par le client PostgreSQL) : le pré-filtre par clés ne
 * trouvait alors aucune candidate.
 */
export const SANCTIONS_PROJECTION_VERSION = "sanctions-v2";

/**
 * Nature d'une entrée : `entity` = organisation typée comme telle par la liste ;
 * `unknown` = type non renseigné par la liste (listes américaines de contrôle des
 * exportations), conservée pour ne pas manquer une société. Les personnes
 * physiques, navires et aéronefs ne sont jamais conservés.
 */
export type SanctionEntryKind = "entity" | "unknown";

/** Type d'une liste : sanctions financières ou contrôle des exportations. */
export type SanctionListNature = "sanctions" | "export_control";

/** Une entrée projetée : seuls ces champs sont écrits en base. */
export type SanctionRow = {
  list_key: SanctionListKey;
  entry_key: string;
  sublist: string | null;
  name: string;
  aliases: string[];
  keys: string[];
  programs: string[];
  countries: string[];
  listed_on: string | null;
  kind: SanctionEntryKind;
};

/** Longueur des préfixes de clé : tolère pluriel et variantes d'orthographe. */
const KEY_PREFIX = 5;
const MAX_KEYS = 80;

/**
 * Clés de pré-filtrage d'un ensemble de dénominations : préfixes (5 caractères) des
 * mots significatifs (≥ 3 caractères, formes juridiques retirées).
 *
 * Écrites à l'import dans `sanctions_entries.keys`, recalculées à la requête : une
 * entrée n'est candidate que si elle partage des clés avec la dénomination
 * interrogée. Le rapprochement fin (Jaro-Winkler, couverture des mots) est ensuite
 * celui du registre des gels — jamais plus permissif que lui.
 */
export function sanctionKeys(names: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const name of names) {
    for (const token of stripLegalForms(name).split(" ")) {
      if (token.length >= 3) keys.add(token.slice(0, KEY_PREFIX));
      if (keys.size >= MAX_KEYS) return [...keys];
    }
  }
  return [...keys];
}

/**
 * Nombre minimal de clés communes exigé d'une candidate. Un rapprochement exige
 * qu'au moins 60 % des mots aient un équivalent : dès deux mots significatifs, deux
 * clés au moins sont donc partagées ; avec un seul mot, une seule.
 */
export function requiredKeyOverlap(queryKeys: readonly string[]): number {
  return queryKeys.length >= 2 ? 2 : 1;
}
