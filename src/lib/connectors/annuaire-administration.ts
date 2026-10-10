import { env, isAnnuaireAdministrationEnabled, isDemoMode } from "@/lib/env";
import {
  odsFetch,
  odsLiteral,
  odsText,
  odsToResult,
  odsUrl,
} from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Connecteur « Annuaire de l'administration » (DILA / service-public.gouv.fr,
 * jeu `api-lannuaire-administration`, Opendatasoft). Ouvert, SANS clé.
 * Rapprochement EXACT par SIREN ; interrogé seulement pour une personne morale de
 * droit public (catégorie juridique 7xxx).
 *
 * Minimisation : le jeu contient des agents nommés (`affectation_personne`),
 * coordonnées et horaires — aucun n'est sélectionné ni conservé. Seuls le nom du
 * service, son type et le lien officiel sont repris.
 */
export type AnnuaireService = {
  name: string | null;
  /** « mairie », « epci »… (champ `pivot.type_service_local`). */
  type: string | null;
  url: string | null;
};

export type AnnuaireRaw = {
  status: "ok" | "indisponible";
  /** Nombre total de services référencés pour ce SIREN (la liste est plafonnée). */
  total: number;
  services: AnnuaireService[];
};

const DATASET = "api-lannuaire-administration";
const LIMIT = 20;
const SELECT = ["nom", "pivot", "url_service_public"];
const empty = (): AnnuaireRaw => ({ status: "indisponible", total: 0, services: [] });

/** `pivot` est une chaîne JSON : [{"type_service_local": "mairie", …}]. */
function serviceType(pivot: unknown): string | null {
  try {
    const data = typeof pivot === "string" ? JSON.parse(pivot) : pivot;
    const first = Array.isArray(data) ? data[0] : null;
    return odsText((first as { type_service_local?: unknown } | null)?.type_service_local);
  } catch {
    return null;
  }
}

export const annuaireAdministration = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isAnnuaireAdministrationEnabled()) {
      return {
        raw: { status: "ok", total: 0, services: [] } satisfies AnnuaireRaw,
        endpoint: `fixture:annuaire-administration:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (!/^\d{9}$/.test(siren)) {
      return {
        raw: { status: "ok", total: 0, services: [] } satisfies AnnuaireRaw,
        endpoint: "annuaire-administration:siren-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const url = odsUrl({
      baseUrl: env.ANNUAIRE_BASE_URL,
      dataset: DATASET,
      where: `siren=${odsLiteral(siren)}`,
      select: SELECT,
      limit: LIMIT,
    });
    return odsToResult<AnnuaireRaw>(
      await odsFetch(url, "ANNUAIRE"),
      url,
      (out) => ({
        status: "ok",
        total: out.total,
        services: out.records.map<AnnuaireService>((r) => ({
          name: odsText(r.nom),
          type: serviceType(r.pivot),
          url: odsText(r.url_service_public),
        })),
      }),
      empty,
    );
  },
};
