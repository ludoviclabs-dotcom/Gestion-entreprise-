import { createHash } from "node:crypto";
import type { CaseEvent } from "@/lib/graph/graph-types";
import { dgalData } from "./dgal-data";
import { DGAL_PAGE, dgalSection } from "./dgal-reference";
export const DGAL_LABEL = "Agréments sanitaires CE (DGAL)";
export function dgalAttributes(raw: unknown): Record<string, string> {
  const p = dgalData.safeParse(raw); if (!p.success) return {};
  const d = p.data;
  const presence = d.totalSites ? `${d.totalSites} établissement(s), ${d.totalApprovals} couple(s) établissement/agrément listé(s). ` +
    d.bySection.map(s => `${dgalSection(s.section)!.label} : ${s.count}`).join(" ; ") + ". " : "Aucun établissement rapproché dans les listes importées. ";
  const detail = d.items.map(i => `SIRET ${i.siret}, agrément ${i.approval} : ` + i.activities.map(a =>
    `${dgalSection(a.section)!.label}${a.categories.length ? ` (codes ${a.categories.join(", ")})` : ""}${a.associated.length ? ` ; activités associées ${a.associated.join(", ")}` : ""}`).join(" / ") +
    (i.exportedOn ? ` ; export du ${i.exportedOn}` : " ; date d’export non renseignée")).join(" — ");
  return { [DGAL_LABEL]: presence + `Établissements agréés listés au ${d.observedAt.slice(0, 10)} ; jeu importé le ${d.importedAt.slice(0, 10)}. ` +
    (detail ? `Détail limité à 20 couples : ${detail}. ` : "") +
    `Couverture : 18 listes CE (sections 0 à XVI et cuisines centrales), SIRET à SIREN exploitable uniquement ; agrément propre à l’établissement et à ses activités. ` +
    `L’absence ne vaut pas non-agrément ; une disparition ne prouve pas une radiation. Dates d’export et d’observation, sans date d’attribution ni de validité d’agrément. Source officielle : ${DGAL_PAGE}` };
}
/** Événements d'observation, pas d'attribution inventée ni de radiation déduite. */
export function normalizeDgal(raw: unknown, entityId: string): CaseEvent[] {
  const p = dgalData.safeParse(raw); if (!p.success) return [];
  const d = p.data;
  return d.items.map(i => ({ id: `ev:dgal:${createHash("sha256").update(`${i.siret}:${i.approval}`).digest("hex").slice(0, 24)}`,
    entityId, kind: "agrement_sanitaire_liste", occurredOn: d.observedAt.slice(0, 10), evidenceLevel: "declared", source: DGAL_LABEL,
    title: `Établissement SIRET ${i.siret}, agrément sanitaire CE ${i.approval} — listé dans les exports DGAL observés le ${d.observedAt.slice(0, 10)}` }));
}
