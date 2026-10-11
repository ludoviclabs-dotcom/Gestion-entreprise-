import type { CaseEdge, CaseEntity, EvidenceLevel } from "@/lib/graph/graph-types";
import type { SanctionMatch, SanctionsIntlRaw } from "@/lib/connectors/sanctions-intl";
import { stripLegalForms } from "@/lib/match/normalize";
import { slugify } from "@/lib/text";

/**
 * Normalise les correspondances aux listes de sanctions internationales.
 *
 * Doctrine — un rapprochement par NOM est une HYPOTHÈSE à vérifier, jamais un fait :
 *  - correspondance FORTE (retenue dans le graphe, donc dans les signaux) : nom
 *    exact ou très proche (≥ 0,96, dénomination d'au moins 10 caractères) d'une
 *    entrée de type organisation, ET nom interrogé distinctif (au moins deux mots
 *    dont un d'usage non courant) ;
 *  - correspondance FAIBLE (nom court ou générique, type non précisé par la liste,
 *    rapprochement approximatif moins sûr) : signalée dans un attribut, jamais
 *    dans le graphe — un nom comme « ATLAS » ne doit pas faire monter la
 *    vigilance d'une société française à cause d'une homonyme étrangère.
 *  - aucune correspondance n'est présentée comme « confirmée ».
 */
export const STRONG_APPROX_SCORE = 0.96;
/** Un rapprochement approximatif n'est retenu que pour une dénomination assez longue. */
const STRONG_APPROX_MIN_LENGTH = 10;
/** Un mot distinctif a au moins cette longueur. */
const DISTINCTIVE_MIN_LENGTH = 3;

/**
 * Mots d'usage courant qui ne distinguent pas une société d'une autre (FR/EN) : une
 * dénomination faite uniquement de ces mots (« AM GROUP », « ALLIANCE
 * INTERNATIONAL ») ne porte aucune identité. Mesuré sur 906 sociétés françaises
 * réelles : ces noms génériques étaient la quasi-totalité des fausses alertes.
 */
const GENERIC_WORDS = new Set([
  "group", "groupe", "holding", "holdings", "international", "internationale", "intl",
  "company", "compagnie", "corp", "corporation", "limited", "trading", "trade",
  "commerce", "import", "export", "imports", "exports", "industries", "industrie",
  "industry", "industrial", "services", "service", "solutions", "systems", "systemes",
  "technology", "technologies", "tech", "global", "europe", "european", "france",
  "french", "general", "generale", "national", "nationale", "capital", "invest",
  "investment", "investments", "management", "consulting", "conseil", "finance",
  "financial", "partners", "partenaires", "enterprise", "enterprises", "entreprise",
  "entreprises", "societe", "transport", "transports", "logistics", "logistique",
  "bank", "banque", "energy", "energie", "petrol", "petroleum", "oil", "gas",
  "alliance", "union", "center", "centre", "institute", "institut", "association",
  "fondation", "foundation", "agency", "agence", "bureau", "office",
  "populaire", "populaires", "central", "centrale", "regional", "regionale",
  "nouvelle", "nouveau", "grand", "grande", "premier", "premiere", "mutuelle",
]);

/** Mots significatifs d'une dénomination (formes juridiques retirées, ≥ 2 caractères). */
const significantTokens = (name: string) =>
  stripLegalForms(name).split(" ").filter((t) => t.length >= 2);

/**
 * Une dénomination est distinctive si elle compte au moins deux mots ET au moins un
 * mot qui n'est pas d'usage courant. Un nom d'un seul mot n'est jamais retenu :
 * c'est la première source d'homonymes (« ATLAS », « PHOENIX », « ALLIANCE »).
 */
export function isDistinctiveName(name: string): boolean {
  const tokens = significantTokens(name);
  if (tokens.length < 2) return false;
  return tokens.some((t) => t.length >= DISTINCTIVE_MIN_LENGTH && !GENERIC_WORDS.has(t));
}

export function classifyMatch(m: SanctionMatch): "strong" | "weak" {
  if (m.kind !== "entity") return "weak";
  if (!isDistinctiveName(m.queryName)) return "weak";
  if (m.matchType === "exact") return "strong";
  // Approximatif : score élevé ET dénomination assez longue (« AM GROUP » ≈
  // « AMS GROUP » à 0,97 ne dit rien).
  return m.score >= STRONG_APPROX_SCORE &&
    stripLegalForms(m.queryName).length >= STRONG_APPROX_MIN_LENGTH
    ? "strong"
    : "weak";
}

/** Listes de contrôle des exportations ou d'exclusion (≠ gel d'avoirs). */
const EXPORT_CONTROL = /\b(BIS|DDTC|ITAR|Entity List|Denied Persons|Unverified|Military End User|Nonproliferation)\b/i;
export const listNature = (sublist: string | null): string =>
  sublist && EXPORT_CONTROL.test(sublist)
    ? "Contrôle des exportations ou exclusion (≠ gel d'avoirs)"
    : "Sanctions";

export const SANCTIONS_INTL_ATTRIBUTE = "Listes de sanctions internationales";
const MAX_ATTRIBUTE = 700;

export type SanctionsIntlNormalized = {
  entities: CaseEntity[];
  edges: CaseEdge[];
  attributes: Record<string, string>;
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "date inconnue");

/**
 * @param ctx.entityIds clé de requête (« subject », « lei:… ») → identifiant du
 *   nœud société interrogé ; une correspondance dont la clé est inconnue est ignorée.
 */
export function normalizeSanctionsIntl(
  raw: unknown,
  ctx: { entityIds: Record<string, string> },
): SanctionsIntlNormalized {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<SanctionsIntlRaw>;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const lists = Array.isArray(data.lists) ? data.lists : [];
  const entities = new Map<string, CaseEntity>();
  const edges: CaseEdge[] = [];
  const weak: SanctionMatch[] = [];

  for (const m of matches) {
    const queried = ctx.entityIds[m.queryKey];
    if (!queried || !m.nom) continue;
    if (classifyMatch(m) === "weak") {
      weak.push(m);
      continue;
    }
    const level: EvidenceLevel = m.matchType === "exact" ? "declared" : "simulated";
    const sanctionId = `sa:intl:${m.list}:${slugify(m.entryKey)}`;
    const listName = m.sublist ? `${m.listLabel} — ${m.sublist}` : m.listLabel;
    if (!entities.has(sanctionId)) {
      entities.set(sanctionId, {
        id: sanctionId,
        type: "sanction",
        label: `Correspondance « ${m.nom} »`,
        evidenceLevel: level,
        attributes: {
          Liste: listName,
          Nature: listNature(m.sublist),
          ...(m.programs.length > 0 ? { Programmes: m.programs.slice(0, 3).join(" ; ") } : {}),
          ...(m.countries.length > 0 ? { Pays: m.countries.slice(0, 3).join(" ; ") } : {}),
          ...(m.listedOn ? { "Inscrit le": m.listedOn } : {}),
          Type: m.matchType === "exact" ? "Correspondance exacte" : "Correspondance approximative",
        },
        source: `Listes de sanctions internationales — ${m.listLabel}`,
        excerpt:
          "Rapprochement nominatif avec une liste officielle — à vérifier manuellement (homonymie possible), aucune certitude.",
      });
    }
    edges.push({
      id: `e:${queried}:${sanctionId}`,
      type: "EST_VISE_PAR",
      source: queried,
      target: sanctionId,
      label: m.matchType === "exact" ? "correspondance exacte" : "correspondance possible",
      evidenceLevel: level,
      excerpt: "Listes de sanctions internationales — rapprochement nominatif, hypothèse à vérifier.",
    });
  }

  // Attribut de transparence : listes consultées (avec dates), listes non à jour,
  // correspondances faibles. Écrit même sans correspondance : un « aucune
  // correspondance » ne vaut que pour les listes qu'il nomme.
  const parts: string[] = [];
  const ok = lists.filter((l) => l.state === "ok");
  const notOk = lists.filter((l) => l.state !== "ok");
  if (ok.length > 0) {
    parts.push(
      `Consultées : ${ok.map((l) => `${l.label} (vérifiée le ${day(l.checkedAt)})`).join(" ; ")}.`,
    );
  }
  if (notOk.length > 0) {
    parts.push(
      `Non consultées ou non à jour : ${notOk
        .map((l) => `${l.label} (${l.state === "stale" ? `dernière vérification le ${day(l.checkedAt)}` : "jamais importée"})`)
        .join(" ; ")}.`,
    );
  }
  const strongCount = entities.size;
  if (ok.length > 0 || strongCount > 0) {
    parts.push(
      strongCount === 0 && weak.length === 0
        ? "Aucune correspondance nominative."
        : `${strongCount} correspondance(s) retenue(s) dans le graphe.`,
    );
  }
  if (weak.length > 0) {
    const shown = weak
      .slice(0, 3)
      .map((m) => `« ${m.nom} » (${m.sublist ?? m.listLabel}${m.countries[0] ? `, ${m.countries[0]}` : ""})`)
      .join(" ; ");
    parts.push(
      `${weak.length} correspondance(s) faible(s) non retenue(s) (nom court ou générique, type non précisé ou rapprochement incertain) : ${shown}.`,
    );
  }
  if (data.truncated) {
    parts.push("Pré-sélection tronquée : un nom très générique a pu masquer des candidates.");
  }

  const attributes: Record<string, string> =
    parts.length > 0 ? { [SANCTIONS_INTL_ATTRIBUTE]: parts.join(" ").slice(0, MAX_ATTRIBUTE) } : {};
  return { entities: [...entities.values()], edges, attributes };
}
