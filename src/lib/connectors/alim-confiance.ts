import { env, isAlimConfianceEnabled, isDemoMode } from "@/lib/env";
import {
  odsFetch,
  odsLiteral,
  odsText,
  odsToResult,
  odsUrl,
} from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Connecteur Alim'confiance — résultats PUBLIÉS des contrôles officiels
 * sanitaires (DGAL, jeu `export_alimconfiance`, Opendatasoft). Ouvert, SANS clé.
 *
 * Le jeu est au niveau ÉTABLISSEMENT : on agrège côté source (`group_by`) par
 * niveau de synthèse pour un préfixe de SIRET = SIREN — une seule requête, des
 * comptes exacts même pour une enseigne de plusieurs centaines de points de
 * vente. Aucun établissement n'est nommé.
 *
 * ⚠️ Un résultat d'inspection décrit UN établissement à une date donnée ; il
 * n'est ni une sanction ni une appréciation globale de l'entreprise.
 */
export type AlimLevel = {
  /** « Très satisfaisant », « Satisfaisant », « A améliorer », « A corriger… ». */
  level: string;
  count: number;
  /** Date (AAAA-MM-JJ) du contrôle le plus récent à ce niveau. */
  latest: string | null;
};

export type AlimConfianceRaw = {
  status: "ok" | "indisponible";
  /** Nombre total de contrôles publiés pour ce SIREN (somme des niveaux). */
  total: number;
  levels: AlimLevel[];
};

const DATASET = "export_alimconfiance";
const empty = (): AlimConfianceRaw => ({ status: "indisponible", total: 0, levels: [] });

export const alimConfiance = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isAlimConfianceEnabled()) {
      return {
        raw: { status: "ok", total: 0, levels: [] } satisfies AlimConfianceRaw,
        endpoint: `fixture:alim-confiance:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (!/^\d{9}$/.test(siren)) {
      return {
        raw: { status: "ok", total: 0, levels: [] } satisfies AlimConfianceRaw,
        endpoint: "alim-confiance:siren-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const url = odsUrl({
      baseUrl: env.DGAL_BASE_URL,
      dataset: DATASET,
      where: `startswith(siret, ${odsLiteral(siren)})`,
      select: [
        "synthese_eval_sanit",
        "count(*) as n",
        "max(date_inspection) as derniere",
      ],
      groupBy: "synthese_eval_sanit",
      limit: 20,
    });
    return odsToResult<AlimConfianceRaw>(
      await odsFetch(url, "ALIM_CONFIANCE"),
      url,
      (out) => {
        const levels = out.records
          .map<AlimLevel>((r) => ({
            level: odsText(r.synthese_eval_sanit) ?? "Non renseigné",
            count: Number(r.n),
            latest: odsText(r.derniere)?.slice(0, 10) ?? null,
          }))
          .filter((l) => Number.isFinite(l.count) && l.count > 0);
        return {
          status: "ok",
          total: levels.reduce((sum, l) => sum + l.count, 0),
          levels,
        };
      },
      empty,
    );
  },
};
