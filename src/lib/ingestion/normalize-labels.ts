import type { RgeRaw } from "@/lib/connectors/rge";
import type { AgenceBioRaw } from "@/lib/connectors/agence-bio";
import type { AlimConfianceRaw } from "@/lib/connectors/alim-confiance";
import type { QualiopiRaw } from "@/lib/connectors/qualiopi";

/**
 * Normalisation du lot « labels » : RGE (ADEME), Agence BIO, Alim'confiance
 * (DGAL), organismes de formation / Qualiopi (DGEFP).
 *
 * Ces sources ne produisent que des ATTRIBUTS de synthèse sur la société sujet —
 * ni événement, ni lien, ni signal de risque :
 *  - un label ou une certification est une information, jamais une alerte ;
 *  - l'absence d'un label n'est pas un manquement (non interrogé sans signal) ;
 *  - un résultat Alim'confiance décrit des établissements à une date donnée, il
 *    n'est ni une sanction ni une appréciation globale de l'entreprise.
 *
 * Fonctions pures, défensives : ne lèvent jamais. Aucune valeur n'est inventée :
 * une consultation vide ou en échec ne produit aucun attribut.
 */

const asData = <T,>(raw: unknown): Partial<T> =>
  (raw && typeof raw === "object" ? raw : {}) as Partial<T>;

const uniq = (values: (string | null | undefined)[]): string[] => [
  ...new Set(values.filter((v): v is string => Boolean(v && v.trim()))),
];
const plural = (n: number, one: string, many: string): string => (n > 1 ? many : one);
const maxDate = (dates: (string | null | undefined)[]): string | null =>
  uniq(dates).sort().at(-1) ?? null;
const minDate = (dates: (string | null | undefined)[]): string | null =>
  uniq(dates).sort().at(0) ?? null;

export const LABEL_ATTRIBUTE_KEYS = {
  rge: "RGE (ADEME)",
  bio: "Agriculture biologique (Agence BIO)",
  alim: "Contrôles sanitaires publiés (Alim'confiance)",
  qualiopi: "Organisme de formation (DGEFP)",
} as const;

export function rgeSummary(raw: unknown): string | null {
  const d = asData<RgeRaw>(raw);
  if (d.status !== "ok" || !Array.isArray(d.lines) || d.lines.length === 0) return null;
  const qualifications = uniq(d.lines.map((l) => l.code ?? l.qualification));
  const establishments = uniq(d.lines.map((l) => l.siret));
  const bodies = uniq(d.lines.map((l) => l.body)).sort();
  const domains = uniq(d.lines.map((l) => l.domain)).slice(0, 3);
  const until = maxDate(d.lines.map((l) => l.to));
  const parts = [
    `${qualifications.length} ${plural(qualifications.length, "qualification", "qualifications")} sur ${establishments.length} ${plural(establishments.length, "établissement", "établissements")}`,
    domains.length > 0 ? `domaines : ${domains.join(", ")}` : null,
    bodies.length > 0 ? `${plural(bodies.length, "organisme", "organismes")} : ${bodies.join(", ")}` : null,
    until ? `dernière échéance : ${until}` : null,
  ].filter(Boolean);
  const sample =
    typeof d.total === "number" && d.total > d.lines.length
      ? ` (${d.lines.length} lignes analysées sur ${d.total})`
      : "";
  return parts.join(" — ") + sample;
}

/** États de certification Agence BIO → libellé français (le reste : minuscules). */
const BIO_STATES: Record<string, string> = {
  ENGAGEE: "engagée",
  ARRETEE: "arrêtée",
  SUSPENDUE: "suspendue",
  NON_ENGAGEE: "non engagée",
};

export function bioSummary(raw: unknown): string | null {
  const d = asData<AgenceBioRaw>(raw);
  if (d.status !== "ok" || !Array.isArray(d.operators) || d.operators.length === 0) {
    return null;
  }
  const certificates = d.operators.flatMap((o) => o.certificates ?? []);
  const bodies = uniq(certificates.map((c) => c.body)).sort();
  const states = new Map<string, number>();
  for (const c of certificates) {
    const key = (c.state ?? "").toUpperCase();
    const state = BIO_STATES[key] ?? (key ? key.toLowerCase() : "état non renseigné");
    states.set(state, (states.get(state) ?? 0) + 1);
  }
  const total = typeof d.total === "number" && d.total > 0 ? d.total : d.operators.length;
  const since = minDate(certificates.map((c) => c.engagedOn));
  // La source ne permet aucun comptage par état : la ventilation porte sur les
  // établissements analysés (premiers renvoyés), jamais présentée comme exacte.
  const sample =
    total > d.operators.length ? ` (sur ${d.operators.length} analysés)` : "";
  const parts = [
    `${total} ${plural(total, "établissement enregistré", "établissements enregistrés")}`,
    bodies.length > 0
      ? `${plural(bodies.length, "certificateur", "certificateurs")} : ${bodies.join(", ")}`
      : null,
    states.size > 0
      ? `états${sample} : ${[...states].map(([s, n]) => `${s} ×${n}`).join(", ")}`
      : null,
    since ? `plus ancien engagement : ${since}` : null,
  ].filter(Boolean);
  return parts.join(" — ");
}

/** Ordre d'affichage des niveaux de synthèse (du plus favorable au moins favorable). */
const ALIM_ORDER = ["très satisfaisant", "satisfaisant", "a améliorer", "à améliorer", "a corriger"];
const alimRank = (level: string): number => {
  const l = level.toLowerCase();
  const i = ALIM_ORDER.findIndex((o) => l.startsWith(o));
  return i === -1 ? ALIM_ORDER.length : i;
};

export function alimSummary(raw: unknown): string | null {
  const d = asData<AlimConfianceRaw>(raw);
  if (d.status !== "ok" || !Array.isArray(d.levels) || d.levels.length === 0) return null;
  const total = d.levels.reduce((sum, l) => sum + (l.count || 0), 0);
  if (total <= 0) return null;
  const levels = [...d.levels]
    .sort((a, b) => alimRank(a.level) - alimRank(b.level) || b.count - a.count)
    .map((l) => `${l.level} ${l.count}`)
    .join(" · ");
  const latest = maxDate(d.levels.map((l) => l.latest));
  return (
    `${total} ${plural(total, "contrôle publié", "contrôles publiés")} : ${levels}` +
    (latest ? ` — dernier contrôle : ${latest}` : "")
  );
}

export function qualiopiSummary(raw: unknown): string | null {
  const d = asData<QualiopiRaw>(raw);
  if (d.status !== "ok" || !Array.isArray(d.organisations) || d.organisations.length === 0) {
    return null;
  }
  const ndas = uniq(d.organisations.map((o) => o.nda));
  const categories = uniq(d.organisations.flatMap((o) => o.categories ?? []));
  const declaration =
    ndas.length > 0
      ? `déclaration d'activité n° ${ndas.slice(0, 3).join(", ")}${ndas.length > 3 ? ` (+${ndas.length - 3})` : ""}`
      : "déclaration d'activité";
  const certification =
    categories.length > 0
      ? `certification Qualiopi : ${categories.join(", ")}`
      : "aucune catégorie de certification renseignée";
  return `${declaration} — ${certification}`;
}

/**
 * Attributs de synthèse greffés sur la société sujet. Aucun attribut si la
 * consultation n'a pas abouti ou n'a rien trouvé.
 */
export function labelsAttributes(parts: {
  rge?: unknown;
  bio?: unknown;
  alim?: unknown;
  qualiopi?: unknown;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  const rge = rgeSummary(parts.rge);
  if (rge) attrs[LABEL_ATTRIBUTE_KEYS.rge] = rge;
  const bio = bioSummary(parts.bio);
  if (bio) attrs[LABEL_ATTRIBUTE_KEYS.bio] = bio;
  const alim = alimSummary(parts.alim);
  if (alim) attrs[LABEL_ATTRIBUTE_KEYS.alim] = alim;
  const qualiopi = qualiopiSummary(parts.qualiopi);
  if (qualiopi) attrs[LABEL_ATTRIBUTE_KEYS.qualiopi] = qualiopi;
  return attrs;
}
