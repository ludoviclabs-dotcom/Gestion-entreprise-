import { importedIcpeData } from "./icpe-data";
import type { GeorisquesRaw } from "@/lib/connectors/georisques";
import type { AnnuaireRaw } from "@/lib/connectors/annuaire-administration";

/**
 * Normalisation du lot « réglementaire » : Géorisques (installations classées) et
 * Annuaire de l'administration.
 *
 * Seulement des ATTRIBUTS de synthèse sur la société sujet — ni événement, ni lien,
 * ni signal de risque :
 *  - une installation classée est un régime administratif attaché à un site, pas
 *    un manquement ; les rapports d'inspection ne sont pas repris ;
 *  - la COUVERTURE est dite : l'API ne se rapproche que par SIRET, donc pour un
 *    groupe multi-sites seuls les établissements interrogés sont couverts ;
 *  - une absence n'est jamais affirmée (aucun attribut quand rien n'est trouvé).
 *
 * Fonctions pures, défensives : ne lèvent jamais.
 */

const asData = <T,>(raw: unknown): Partial<T> =>
  (raw && typeof raw === "object" ? raw : {}) as Partial<T>;

const plural = (n: number, one: string, many: string): string => (n > 1 ? many : one);
const count = (values: string[]): [string, number][] => {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
};
const nf = (n: number): string => n.toLocaleString("fr-FR", { useGrouping: true }).replace(/ /g, " ");

export const REGULATORY_ATTRIBUTE_KEYS = {
  icpe: "Installations classées (Géorisques)",
  annuaire: "Annuaire de l'administration",
} as const;

export function icpeSummary(raw: unknown): string | null {
  if (asData<{ coverage: string }>(raw).coverage === "national-import") {
    const parsed = importedIcpeData.safeParse(raw);
    if (!parsed.success) return null;
    const d = parsed.data;
    const groups = (list: typeof d.byRegime) => list.map(g => `${g.label || "non renseigné"} ×${nf(g.count)}`).join(", ");
    return [
      d.total ? `${nf(d.total)} installations classées rapprochées sur ${nf(d.establishments)} établissements` : "Aucune installation classée rapprochée de ce SIREN dans le jeu importé",
      d.total ? `régimes : ${groups(d.byRegime)}` : null,
      d.total ? `états : ${groups(d.byStatus)}` : null,
      d.total ? `Seveso : ${groups(d.bySeveso)}` : null,
      d.ied ? `directive IED ×${nf(d.ied)}` : null,
      d.nationalPriority ? `priorité nationale ×${nf(d.nationalPriority)}` : null,
      d.inspections ? `${nf(d.inspections)} inspections référencées` : null,
      d.lastInspection ? `dernière inspection : ${d.lastInspection}` : null,
      `jeu national importé le ${d.importedAt.slice(0, 10)} ; rapprochement limité aux SIRET exploitables publiés`,
      d.total > 20 ? "totaux complets, détail limité à 20 installations" : null,
    ].filter(Boolean).join(" — ");
  }
  const d = asData<GeorisquesRaw>(raw);
  if (d.status !== "ok" || !Array.isArray(d.sites)) return null;
  // « Non ICPE » : site référencé mais NON classé — ce n'est pas une installation classée.
  const classified = d.sites.filter((s) => s?.regime && !/non\s*icpe/i.test(s.regime));
  if (classified.length === 0) return d.importFallback
    ? `Import national non encore réalisé — aucun site classé trouvé lors de la consultation directe des ${d.queried ?? 0} établissements interrogés (couverture limitée)` : null;

  const queried = typeof d.queried === "number" && d.queried > 0 ? d.queried : classified.length;
  const regimes = count(classified.map((s) => s.regime as string))
    .map(([r, n]) => `${r} ×${n}`)
    .join(", ");
  const seveso = classified.filter((s) => s.seveso && /seuil/i.test(s.seveso));
  const ied = classified.filter((s) => s.ied).length;
  // État d'exploitation (« en fin d'exploitation », « en exploitation avec titre »…).
  const statuses = count(
    classified.map((s) => s.status).filter((x): x is string => Boolean(x)),
  )
    .map(([st, n]) => `${st.toLowerCase()} ×${n}`)
    .join(", ");
  const lastInspection =
    classified
      .map((s) => s.lastInspection)
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1) ?? null;

  const parts = [
    `${classified.length} ${plural(classified.length, "installation classée", "installations classées")} sur ${queried} ${plural(queried, "établissement interrogé", "établissements interrogés")}`,
    `régimes : ${regimes}`,
    statuses ? `état : ${statuses}` : null,
    seveso.length > 0
      ? `${count(seveso.map((s) => s.seveso as string))
          .map(([s, n]) => `${s} ×${n}`)
          .join(", ")}`
      : null,
    ied > 0 ? `directive IED ×${ied}` : null,
    lastInspection ? `dernière inspection : ${lastInspection}` : null,
  ].filter(Boolean);

  const open = typeof d.openTotal === "number" ? d.openTotal : null;
  const coverage =
    open !== null && queried < open
      ? ` — couverture partielle : ${queried} ${plural(queried, "établissement", "établissements")} sur ${nf(open)} ouverts (l'API Géorisques ne se rapproche que par SIRET)`
      : "";
  return parts.join(" — ") + coverage + (d.importFallback ? " — import national non encore réalisé ; repli sur la consultation directe limitée aux établissements interrogés" : "");
}

export function annuaireSummary(raw: unknown): string | null {
  const d = asData<AnnuaireRaw>(raw);
  if (d.status !== "ok" || !Array.isArray(d.services) || d.services.length === 0) return null;
  const total = typeof d.total === "number" && d.total > 0 ? d.total : d.services.length;
  const types = count(d.services.map((s) => s?.type).filter((t): t is string => Boolean(t)))
    .map(([t, n]) => `${t} ×${n}`)
    .join(", ");
  const first = d.services.find((s) => s?.url);
  return [
    `${nf(total)} ${plural(total, "service référencé", "services référencés")}`,
    types ? `types : ${types}` : null,
    first?.url ? `fiche : ${first.url}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

/** Attributs de synthèse ; aucun attribut si la consultation n'a rien trouvé. */
export function regulatoryAttributes(parts: {
  icpe?: unknown;
  annuaire?: unknown;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  const icpe = icpeSummary(parts.icpe);
  if (icpe) attrs[REGULATORY_ATTRIBUTE_KEYS.icpe] = icpe;
  const annuaire = annuaireSummary(parts.annuaire);
  if (annuaire) attrs[REGULATORY_ATTRIBUTE_KEYS.annuaire] = annuaire;
  return attrs;
}
