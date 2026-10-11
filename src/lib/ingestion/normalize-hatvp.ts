import { hatvpData } from "./hatvp-data";

export const HATVP_LABEL = "Répertoire HATVP";
const frDate = (d: string) => d.split("-").reverse().join("/");

/** Attribut professionnel neutre ; aucun événement, lien ou signal. */
export function hatvpAttributes(raw: unknown): Record<string, string> {
  const parsed = hatvpData.safeParse(raw);
  if (!parsed.success) return {};
  const { organisation: r, importedAt } = parsed.data;
  if (!r) return { [HATVP_LABEL]: `Non inscrite dans le jeu importé le ${importedAt.slice(0, 10)}. Rapprochement limité aux SIREN exploitables publiés.` };
  const parts = [
    r.ceasedOn ? `Désinscrite le ${frDate(r.ceasedOn)}${r.deregistrationReason ? ` (${r.deregistrationReason === "CESSATION" ? "cessation" : "abandon"})` : ""}`
      : `Inscrite au répertoire HATVP${r.firstPublishedOn ? ` depuis ${r.firstPublishedOn.slice(0, 4)}` : ""}`,
    r.categoryLabel ? `catégorie : ${r.categoryLabel}` : "catégorie non renseignée",
    r.lastActivityPublishedOn ? `dernière publication d’activités : ${frDate(r.lastActivityPublishedOn)}` : null,
    r.activitiesPublished === null ? "publication d’activités non renseignée" : r.activitiesPublished ? "activités publiées" : "aucune activité publiée renseignée",
    // Le dernier exercice peut être encore ouvert (constaté chez les quatre témoins).
    r.lastExerciseEnd ? `exercice se terminant le ${frDate(r.lastExerciseEnd)}${r.activityCountLast === null ? " : volume non renseigné" : ` : ${r.activityCountLast} activité(s) déclarée(s)`}` : null,
    r.noActivityDeclared === true ? "déclaration explicite d’absence d’activité pour cet exercice" : null,
    `fiche officielle : https://www.hatvp.fr/fiche-organisation/?organisation=${r.siren}`,
    `jeu importé le ${importedAt.slice(0, 10)}`,
    "L’inscription relève de la transparence légale. Un exercice encore ouvert ne constitue pas un bilan d’activité définitif.",
  ];
  return { [HATVP_LABEL]: parts.filter(Boolean).join(" — ") };
}
