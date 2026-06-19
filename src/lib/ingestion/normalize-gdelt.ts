import type { CaseEntity, CaseEvent } from "@/lib/graph/graph-types";
import { normalizeName, stripLegalForms } from "@/lib/match/normalize";

/**
 * Normalise les articles GDELT en événements « couverture médiatique » rattachés
 * aux entités du graphe. COMPUTE-FIRST : on ne génère aucun récit — on horodate
 * et on source des articles existants. Niveau de preuve `inferred` (presse, pas
 * un registre). L'appariement nominatif réutilise le moteur de résolution
 * d'entité (`normalizeName`/`stripLegalForms`). Aucune alerte ici : les
 * événements sont surfacés pour examen humain (faisceau), jamais une conclusion.
 */
export type GdeltArticle = {
  title?: string;
  url?: string;
  domain?: string;
  seendate?: string;
  tone?: number;
  language?: string;
  sourcecountry?: string;
};

/** Tonalité en deçà de laquelle un article est marqué défavorable (si fournie). */
const ADVERSE_TONE = -3;

/** YYYYMMDDTHHMMSSZ (GDELT) → YYYY-MM-DD, ou undefined. */
function gdeltDate(seendate?: string): string | undefined {
  if (!seendate || seendate.length < 8) return undefined;
  return `${seendate.slice(0, 4)}-${seendate.slice(4, 6)}-${seendate.slice(6, 8)}`;
}

/** Tous les tokens significatifs (> 2 car., forme juridique retirée) du nom de
 *  l'entité sont-ils présents dans le titre ? (appariement nominatif précis). */
function nameInTitle(entityLabel: string, titleTokens: Set<string>): boolean {
  const nameTokens = normalizeName(stripLegalForms(entityLabel))
    .split(" ")
    .filter((t) => t.length > 2);
  if (nameTokens.length === 0) return false;
  return nameTokens.every((t) => titleTokens.has(t));
}

export function normalizeGdelt(
  raw: unknown,
  opts: { subjectId: string; entities: CaseEntity[] },
): CaseEvent[] {
  const articles = ((raw as { articles?: GdeltArticle[] })?.articles ?? []).filter(
    (a): a is GdeltArticle => Boolean(a) && typeof a === "object",
  );
  const named = opts.entities.filter(
    (e) => e.type === "company" || e.type === "person",
  );
  const events: CaseEvent[] = [];

  articles.forEach((a, i) => {
    const title = (a.title ?? "").trim();
    if (!title) return;
    const titleTokens = new Set(normalizeName(title).split(" "));
    const matched = named.filter((e) => nameInTitle(e.label, titleTokens));
    // À défaut d'appariement nominatif fort dans le titre, on rattache au sujet
    // (GDELT a filtré par son nom : le sujet est mentionné dans le corps).
    const targetIds =
      matched.length > 0 ? matched.map((e) => e.id) : [opts.subjectId];
    const adverse = typeof a.tone === "number" && a.tone <= ADVERSE_TONE;
    const seen = new Set<string>();
    for (const entityId of targetIds) {
      if (seen.has(entityId)) continue;
      seen.add(entityId);
      events.push({
        id: `ev:gdelt:${i}:${entityId}`,
        entityId,
        kind: adverse ? "couverture_media_defavorable" : "couverture_media",
        title: title.slice(0, 200),
        occurredOn: gdeltDate(a.seendate),
        evidenceLevel: "inferred",
        source: `Presse (GDELT)${a.domain ? ` — ${a.domain}` : ""}`,
      });
    }
  });

  return events;
}
