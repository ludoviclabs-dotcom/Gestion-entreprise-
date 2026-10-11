import {
  SANCTION_IMPORT_SOURCES,
  SANCTION_LIST_KEYS,
  type SanctionListKey,
} from "../../../src/lib/connectors/sanctions-lists";

/** Les cinq listes de sanctions internationales, une transaction chacune. */
export const SANCTION_SOURCES: readonly string[] = SANCTION_LIST_KEYS.map((k) => SANCTION_IMPORT_SOURCES[k]);

export const listOfSource = (source: string): SanctionListKey | undefined =>
  SANCTION_LIST_KEYS.find((k) => SANCTION_IMPORT_SOURCES[k] === source);

/** Jeux importables un par un. */
export const SINGLE_SOURCES: readonly string[] = ["camino", "icpe", "tresor_gels", ...SANCTION_SOURCES];

/**
 * Groupes de sources : « all » (rendez-vous mensuel) importe tout ; « sanctions »
 * les cinq listes internationales ; « daily » (rendez-vous quotidien) tout ce qui
 * sert à un CONTRÔLE de sanctions — registre français des gels et listes
 * internationales — et dont une copie vieille d'un mois serait trompeuse.
 */
export const GROUPS: Record<string, readonly string[]> = {
  all: SINGLE_SOURCES,
  sanctions: SANCTION_SOURCES,
  daily: ["tresor_gels", ...SANCTION_SOURCES],
};

/** Sources à importer pour un argument de ligne de commande (`undefined` = inconnu). */
export function sourcesFor(argument: string): readonly string[] | undefined {
  if (argument === "check") return [];
  if (argument in GROUPS) return GROUPS[argument];
  return SINGLE_SOURCES.includes(argument) ? [argument] : undefined;
}
