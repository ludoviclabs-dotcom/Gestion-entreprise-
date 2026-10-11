import type { CaseEvent } from "@/lib/graph/graph-types";
import { decpData } from "./decp-data";
export const DECP_LABEL = "Marchés publics attribués (DECP)";
export const DECP_BUYER_LABEL = "Commande publique (acheteur, DECP)";
export function decpAttributes(raw: unknown): Record<string, string> {
  const parsed = decpData.safeParse(raw); if (!parsed.success) return {};
  const d = parsed.data;
  const text = (s: typeof d.holder) => (s.total ? `${s.total} marché(s) notifié(s) ; montant cumulé déclaré : ${s.reliableAmount.toLocaleString("fr-FR")} EUR pour ${s.singleReliable} marché(s) à un seul titulaire et montant fiable.` +
    ` Dont ${s.grouped} en groupement, montant non réparti ; ${s.unreliable} montant(s) non fiable(s), exclu(s) du cumul.` +
    (s.lastNotified ? ` Dernière notification : ${s.lastNotified}.` : "") +
    (s.buyers.length ? ` Principaux acheteurs (SIRET) : ${s.buyers.map(b => `${b.id} (${b.count})`).join(" ; ")}.` : "")
    : "Aucun marché notifié sur la fenêtre importée.") +
    ` Fenêtre de notification : ${d.windowStart} au ${d.windowEnd}, inclus. Jeu importé le ${d.importedAt.slice(0, 10)} ; fichiers disponibles jusqu'à ${d.latestFileMonth}.` +
    " Titulaires et montants à la notification ; modifications non exploitées. Couverture limitée aux marchés ayant au moins un titulaire SIRET à SIREN exploitable ; chronologie limitée à 20 marchés.";
  return { [DECP_LABEL]: text(d.holder), [DECP_BUYER_LABEL]: text(d.buyer) };
}
export function normalizeDecp(raw: unknown, entityId: string): CaseEvent[] {
  const parsed = decpData.safeParse(raw); if (!parsed.success) return [];
  const d = parsed.data, events = new Map<string, CaseEvent>();
  for (const [role, items] of [["holder", d.holder.items], ["buyer", d.buyer.items]] as const) {
    for (const i of items) {
      if (events.has(i.key)) continue;
      events.set(i.key, { id: `ev:decp:${i.key}`, entityId, kind: "marche_public_attribue", occurredOn: i.notifiedOn,
        evidenceLevel: "declared", source: DECP_LABEL,
        title: role === "holder" ? `Marché notifié à SIREN ${d.siren} (titulaire déclaré dans les DECP) — acheteur SIRET ${i.buyerId}, CPV ${i.cpv}`
          : `Marché notifié par SIREN ${d.siren} (acheteur déclaré dans les DECP) — CPV ${i.cpv}` });
    }
  }
  return [...events.values()].sort((a, b) => b.occurredOn!.localeCompare(a.occurredOn!) || a.id.localeCompare(b.id)).slice(0, 20);
}
