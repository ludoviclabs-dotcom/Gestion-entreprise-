/** Catalogue institutionnel vérifié dans l'export HATVP du 11/10/2026.
 * Aucun libellé libre amont n'est conservé, même dans les champs de catégorie. */
export const HATVP_CATEGORIES: Record<string, readonly [string, string]> = {
  SCOMCIV: ["Société commerciale et civile (autre que cabinet d’avocats et société de conseil)", "ENTREPRISE"],
  ORGSYN: ["Organisation syndicale et professionnelle", "GROUP_PRO"],
  FEDPRO: ["Fédération professionnelle", "GROUP_PRO"],
  CHACONS: ["Chambre consulaire", "GROUP_PRO"],
  ORGAUT: ["Autre organisation", "DIVRES"],
  ASSTION: ["Association", "ORG_NO_GOUV"],
  CABCON: ["Cabinet de conseil", "JURISTE"],
  TRAIND: ["Travailleur indépendant", "JURISTE"],
  CABAVO: ["Cabinet d'avocats", "JURISTE"],
  SOCOM: ["Société commerciale", "SOCIETE"],
  COOAGRI: ["Coopérative agricole", "ENTREPRISE"],
  ASSOC: ["Association", "ORGA_NON_GOUV"],
  ORPRO: ["Organisation professionnelle", "ORGA_REP"],
  FONDTION: ["Fondation", "ORG_NO_GOUV"],
  SOCIV: ["Société civile (autre que cabinet d’avocats)", "SOCIETE"],
  ORGRR: ["Organisme de recherche ou de réflexion", "ORGA_NON_GOUV"],
  ORRECH: ["Organisme de recherche", "RECHERCHE"],
  COIND: ["Consultant indépendant", "AVO_CONS"],
  COCAB: ["Cabinet de conseils", "AVO_CONS"],
  CHAMCO: ["Chambre consulaire", "ORGA_REP"],
  EPUB: ["Établissement public exerçant une activité industrielle et commerciale", "DIVRES"],
  REFLEX: ["Groupe de réflexion (think tank)", "RECHERCHE"],
  SYNDI: ["Syndicat", "ORGA_REP"],
  AUORG: ["Autres organisations", "AUTRE"],
  AVCAB: ["Cabinet d’avocats", "AVO_CONS"],
  AVIND: ["Avocat indépendant", "AVO_CONS"],
  EPAIC: ["Etablissement public exerçant une activité industrielle et commerciale", "ORGA_PUB"],
};

export function hatvpCategory(code: unknown): { code: string; label: string; group: string } | null {
  if (typeof code !== "string" || !Object.hasOwn(HATVP_CATEGORIES, code)) return null;
  const [label, group] = HATVP_CATEGORIES[code];
  return { code, label, group };
}
