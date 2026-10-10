import type { CaseEvent } from "@/lib/graph/graph-types";
import { caminoData } from "./camino-data";

export const CAMINO_LABEL = "Titres miniers (Camino)";
export function caminoAttributes(raw: unknown): Record<string, string> {
  const parsed = caminoData.safeParse(raw);
  if (!parsed.success) return {};
  const d = parsed.data;
  const groups = (list: typeof d.byStatus) => list.map(g => `${g.label || "non renseigné"} : ${g.count}`).join(" ; ");
  const text = d.total === 0 ? "Aucun titre rapproché de ce SIREN dans le jeu importé."
    : `${d.total} titre(s). Statuts : ${groups(d.byStatus)}. Domaines : ${groups(d.byDomain)}.` +
      (d.validUntil ? ` Échéance la plus lointaine des titres déclarés valides : ${d.validUntil}.` : "") +
      ` Un titre échu ou une demande classée ne constitue pas un manquement. Chronologie limitée à 20 événements datés issus des 20 titres aux dates les plus récentes.`;
  return { [CAMINO_LABEL]: `${text} Données importées le ${d.importedAt.slice(0, 10)}. Rapprochement sur les identifiants SIREN exploitables publiés.` };
}

export function normalizeCamino(raw: unknown, entityId: string): CaseEvent[] {
  const parsed = caminoData.safeParse(raw);
  if (!parsed.success) return [];
  const events: CaseEvent[] = [];
  for (const t of parsed.data.items) {
    for (const [kind, date, label] of [
      ["titre_minier_debut", t.startsOn, "Début déclaré"],
      ["titre_minier_echeance", t.endsOn, "Échéance déclarée"],
    ] as const) {
      if (!date) continue;
      events.push({ id: `ev:camino:${t.id}:${kind}`, entityId, kind,
        title: `${label} du titre ${t.name || t.id} (${t.status || "statut non renseigné"})`,
        occurredOn: date, evidenceLevel: "declared", source: CAMINO_LABEL });
    }
  }
  return events.sort((a, b) => b.occurredOn!.localeCompare(a.occurredOn!) || a.id.localeCompare(b.id)).slice(0, 20);
}
