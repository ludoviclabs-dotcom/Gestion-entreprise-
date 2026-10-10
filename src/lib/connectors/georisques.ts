import { env, isDemoMode, isGeorisquesEnabled } from "@/lib/env";
import { odsFetch, odsText, odsToResult } from "./opendatasoft";
import { isDegradedEndpoint } from "./degraded";
import type { ConnectorResult } from "./types";

/**
 * Connecteur Géorisques — installations classées pour la protection de
 * l'environnement (ICPE), API v1 `installations_classees`. Ouvert, SANS clé.
 *
 * ⚠️ L'API n'accepte QUE le SIRET exact (14 chiffres) : le paramètre `siren` est
 * ignoré et renvoie TOUT le fichier national, une recherche par préfixe ou par nom
 * n'existe pas. Le rapprochement se fait donc par établissement ; l'appelant fournit
 * la liste des SIRET interrogés (siège, + établissements ouverts s'ils sont peu
 * nombreux) et la couverture est restituée telle quelle, jamais présentée comme
 * exhaustive pour un groupe multi-sites.
 *
 * ⚠️ Une installation classée n'est ni un manquement ni un risque en soi : c'est
 * un régime administratif (autorisation, enregistrement, déclaration) attaché à un
 * site. Les rapports d'inspection ne sont ni repris ni interprétés.
 */
export type IcpeSite = {
  siret: string;
  name: string | null;
  commune: string | null;
  /** Autorisation, Enregistrement, Autres régimes, Non ICPE… (libellé source). */
  regime: string | null;
  /** « Non Seveso », « Seveso seuil bas », « Seveso seuil haut ». */
  seveso: string | null;
  ied: boolean;
  nationalPriority: boolean;
  /** « En exploitation avec titre », « En fin d'exploitation »… */
  status: string | null;
  inspections: number;
  lastInspection: string | null;
};

export type GeorisquesRaw = {
  status: "ok" | "indisponible";
  /** Nombre d'établissements effectivement interrogés. */
  queried: number;
  /** Établissements ouverts du SIREN (connus par ailleurs), pour exprimer la couverture. */
  openTotal: number | null;
  sites: IcpeSite[];
};

const PAGE_SIZE = 20;
export const MAX_ICPE_SIRETS = 10;
const emptyRaw = (queried: number, openTotal: number | null): GeorisquesRaw => ({
  status: "indisponible",
  queried,
  openTotal,
  sites: [],
});
const isSiret = (v: string): boolean => /^\d{14}$/.test(v);
const bool = (v: unknown): boolean => v === true || v === "true";

export const georisques = {
  async bySirets(
    sirets: string[],
    options: { openTotal?: number | null } = {},
  ): Promise<ConnectorResult<unknown>> {
    const openTotal = options.openTotal ?? null;
    const unique = [...new Set(sirets.filter(isSiret))].slice(0, MAX_ICPE_SIRETS);
    if (isDemoMode() || !isGeorisquesEnabled()) {
      return {
        raw: { status: "ok", queried: 0, openTotal, sites: [] } satisfies GeorisquesRaw,
        endpoint: "fixture:georisques",
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (unique.length === 0) {
      return {
        raw: { status: "ok", queried: 0, openTotal, sites: [] } satisfies GeorisquesRaw,
        endpoint: "georisques:siret-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }

    const urlOf = (siret: string) =>
      `${env.GEORISQUES_BASE_URL}/api/v1/installations_classees?${new URLSearchParams({
        siret,
        page: "1",
        page_size: String(PAGE_SIZE),
      })}`;

    // Une requête par établissement, en parallèle.
    const settled = await Promise.all(
      unique.map(async (siret) => {
        const url = urlOf(siret);
        return odsToResult<GeorisquesRaw>(
          await odsFetch(url, "GEORISQUES"),
          url,
          (out) => ({
            status: "ok",
            queried: 1,
            openTotal,
            sites: out.records
              .filter((r) => odsText(r.siret) === siret) // garde « filtre ignoré »
              .map<IcpeSite>((r) => {
                const inspections = Array.isArray(r.inspections)
                  ? (r.inspections as Record<string, unknown>[])
                  : [];
                return {
                  siret,
                  name: odsText(r.raisonSociale),
                  commune: odsText(r.commune),
                  regime: odsText(r.regime),
                  seveso: odsText(r.statutSeveso),
                  ied: bool(r.ied),
                  nationalPriority: bool(r.prioriteNationale),
                  status: odsText(r.etatActivite),
                  inspections: inspections.length,
                  lastInspection:
                    inspections
                      .map((i) => odsText(i.dateInspection))
                      .filter((d): d is string => Boolean(d))
                      .sort()
                      .at(-1) ?? null,
                };
              }),
          }),
          () => emptyRaw(1, openTotal),
        );
      }),
    );

    // Une seule requête en échec : la consultation entière est dégradée — on ne
    // présente jamais une couverture partielle comme un résultat.
    const failed = settled.find((r) => isDegradedEndpoint(r.endpoint) || r.httpStatus >= 400);
    if (failed) {
      return {
        raw: emptyRaw(unique.length, openTotal),
        endpoint: failed.endpoint,
        httpStatus: failed.httpStatus,
        isFixture: false,
      };
    }
    return {
      raw: {
        status: "ok",
        queried: unique.length,
        openTotal,
        sites: settled.flatMap((r) => (r.raw as GeorisquesRaw).sites),
      } satisfies GeorisquesRaw,
      endpoint:
        unique.length > 1
          ? `${urlOf(unique[0])} (+${unique.length - 1} établissements)`
          : urlOf(unique[0]),
      httpStatus: 200,
      isFixture: false,
    };
  },
};
