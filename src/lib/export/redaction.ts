import type { CaseDetail } from "@/lib/data/types";

/** Mode de redaction d'un export (« redaction-light », avant RBAC Étape 2.2). */
export type RedactionMode = "persons" | "none";

/**
 * Masque les personnes physiques d'un dossier avant export (`?redact=persons`).
 *
 * Chaque personne (entités `person` du graphe + bénéficiaires effectifs
 * déclarés) reçoit un alias stable « Personne #N » (ordre d'apparition), puis
 * TOUTES les occurrences de son nom — libellé complet et jetons individuels
 * (≥ 3 caractères) — sont balayées dans le détail sérialisé : libellés,
 * extraits de preuve, explications de signaux, synthèse, payloads.
 *
 * Sur-masquage assumé : un jeton du nom apparaissant ailleurs (ex. société
 * éponyme « MARTIN HOLDING LTD ») est masqué aussi — pour une redaction-light,
 * mieux vaut trop que pas assez. Pur et déterministe.
 */
export function redactCaseDetail(detail: CaseDetail): CaseDetail {
  const aliases = new Map<string, string>(); // libellé complet → alias
  const needles: Array<[string, string]> = [];

  const register = (label: string | undefined) => {
    const clean = label?.trim();
    if (!clean) return;
    if (!aliases.has(clean)) {
      aliases.set(clean, `Personne #${aliases.size + 1}`);
    }
    const alias = aliases.get(clean)!;
    needles.push([clean, alias]);
    for (const token of clean.split(/\s+/)) {
      if (token.length >= 3) needles.push([token, alias]);
    }
  };

  for (const entity of detail.bundle.entities) {
    if (entity.type === "person") register(entity.label);
  }
  for (const declared of detail.bundle.declaredUbo ?? []) {
    register(
      declared.label ||
        [declared.prenoms, declared.nom].filter(Boolean).join(" "),
    );
  }

  if (needles.length === 0) return detail;

  // Balayage du JSON sérialisé, aiguilles les plus longues d'abord (le
  // libellé complet avant ses jetons). Les accents restent littéraux dans
  // JSON.stringify → la correspondance texte est fidèle.
  needles.sort((a, b) => b[0].length - a[0].length);
  let json = JSON.stringify(detail);
  for (const [needle, alias] of needles) {
    json = json.split(needle).join(alias);
  }
  return JSON.parse(json) as CaseDetail;
}
