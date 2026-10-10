import type { CaseEvent } from "@/lib/graph/graph-types";
import type { BaloRaw } from "@/lib/connectors/balo";
import type { BoampRaw } from "@/lib/connectors/boamp";
import type { AssociationsRaw } from "@/lib/connectors/associations";

/**
 * Normalisation du lot « DILA » : BALO, BOAMP, JOAFE, DCA.
 *
 * Tous produisent des ÉVÈNEMENTS datés rattachés à la société sujet (jamais des
 * liens ni des dirigeants) :
 *  - le fait établi est une PUBLICATION officielle → niveau `confirmed` ;
 *  - aucune relation (propriété, contrôle, attribution) n'est déduite d'une
 *    annonce : un titulaire n'est pas désigné, seuls les noms publiés sont
 *    repris dans le titre ;
 *  - les `kind` sont volontairement DISTINCTS de ceux du BODACC
 *    (`procedure_collective`, `radiation`…) : ils n'influencent aucun facteur
 *    atténuant ni aucune règle de risque existants.
 *
 * Fonctions pures, défensives : ne lèvent jamais.
 */

const asData = <T,>(raw: unknown): Partial<T> =>
  (raw && typeof raw === "object" ? raw : {}) as Partial<T>;

export const SOURCE_LABELS = {
  balo: "BALO — Bulletin des annonces légales obligatoires",
  boamp: "BOAMP — Bulletin officiel des annonces de marchés publics",
  joafe: "JOAFE — Journal officiel des associations",
  dca: "DCA — Comptes annuels des associations",
} as const;

export function normalizeBalo(raw: unknown, companyId: string): CaseEvent[] {
  const data = asData<BaloRaw>(raw);
  if (data.status !== "ok") return [];
  return (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it?.id)
    .map((it) => {
      const category = it.category ?? "Annonce légale";
      const num = it.numero ? ` (affaire n° ${it.numero})` : "";
      const others =
        it.otherSirens.length > 0
          ? ` — publiée avec ${it.otherSirens.length} autre(s) société(s)`
          : "";
      return {
        id: `ev:balo:${it.id}`,
        entityId: companyId,
        kind: "annonce_financiere",
        title: `${category}${num}${others}`,
        occurredOn: it.date ?? undefined,
        evidenceLevel: "confirmed" as const,
        source: SOURCE_LABELS.balo,
      };
    });
}

export function normalizeBoamp(raw: unknown, companyId: string): CaseEvent[] {
  const data = asData<BoampRaw>(raw);
  if (data.status !== "ok") return [];
  return (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it?.id)
    .map((it) => {
      const buyer = it.buyer ? ` — acheteur : ${it.buyer}` : "";
      const tit =
        it.titulaires.length > 0
          ? ` — titulaires publiés : ${it.titulaires.slice(0, 4).join(" ; ")}${
              it.titulaires.length > 4 ? ` (+${it.titulaires.length - 4})` : ""
            }`
          : "";
      return {
        id: `ev:boamp:${it.id}`,
        entityId: companyId,
        kind: "marche_public_resultat",
        // « mentionnant » : le SIREN figure dans l'avis ; le rôle exact n'est pas inféré.
        title: `Résultat de marché mentionnant l'entreprise${buyer}${tit}`,
        occurredOn: it.date ?? undefined,
        evidenceLevel: "confirmed" as const,
        source: SOURCE_LABELS.boamp,
      };
    });
}

export function normalizeDca(raw: unknown, companyId: string): CaseEvent[] {
  const data = asData<AssociationsRaw>(raw);
  if (data.status !== "ok") return [];
  return (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it?.id)
    .map((it) => ({
      id: `ev:dca:${it.id}`,
      entityId: companyId,
      kind: "depot_comptes_association",
      title: it.closedOn
        ? `Dépôt des comptes annuels — exercice clos le ${it.closedOn}`
        : "Dépôt des comptes annuels",
      occurredOn: it.date ?? undefined,
      evidenceLevel: "confirmed" as const,
      source: SOURCE_LABELS.dca,
    }));
}

export function normalizeJoafe(raw: unknown, companyId: string): CaseEvent[] {
  const data = asData<AssociationsRaw>(raw);
  if (data.status !== "ok") return [];
  return (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it?.id)
    .map((it) => {
      const type = it.type ?? "Annonce";
      const state =
        it.state && it.state.toLowerCase() !== "initial" ? ` (${it.state.toLowerCase()})` : "";
      const rename =
        it.titleOld && it.titleNew ? ` : « ${it.titleOld} » → « ${it.titleNew} »` : "";
      const category = it.category ? ` — ${it.category}` : "";
      return {
        id: `ev:joafe:${it.id}`,
        entityId: companyId,
        kind: "annonce_association",
        title: `${type}${state}${category}${rename}`,
        occurredOn: it.date ?? undefined,
        evidenceLevel: "confirmed" as const,
        source: SOURCE_LABELS.joafe,
      };
    });
}

/**
 * Attributs de synthèse greffés sur la société (volumes totaux, la liste
 * d'événements étant plafonnée). Aucun attribut si la consultation n'a pas
 * abouti ou n'a rien trouvé — jamais une valeur inventée.
 */
export function dilaAttributes(parts: {
  balo?: unknown;
  boamp?: unknown;
  dca?: unknown;
  joafe?: unknown;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  const total = (raw: unknown): number => {
    const d = asData<{ status: string; total: number }>(raw);
    return d.status === "ok" && typeof d.total === "number" ? d.total : 0;
  };
  const b = total(parts.balo);
  if (b > 0) attrs["Annonces BALO (total)"] = String(b);
  const m = total(parts.boamp);
  if (m > 0) attrs["Avis de résultat BOAMP mentionnant l'entreprise"] = String(m);
  const c = total(parts.dca);
  if (c > 0) attrs["Dépôts de comptes d'association (total)"] = String(c);
  const j = total(parts.joafe);
  if (j > 0) attrs["Annonces JOAFE (total)"] = String(j);
  return attrs;
}
