/*
 * Styles partagés des actions de l'en-tête du dossier (refonte « Registre / Nuit »).
 * Classes complètes (détectées par Tailwind), uniquement des tokens.
 */

/** Action principale : encre en « Registre », accent en « Nuit ». */
export const HEADER_PRIMARY =
  "inline-flex items-center gap-3 whitespace-nowrap rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-ui hover:bg-primary hover:text-primary-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary-hover";

/** Action secondaire : lien souligné (Exporter, Remettre à trier…). */
export const HEADER_LINK =
  "inline-flex items-center gap-2 whitespace-nowrap border-b border-foreground/50 pb-[3px] text-sm font-medium transition-ui hover:border-primary hover:text-primary disabled:opacity-50";
