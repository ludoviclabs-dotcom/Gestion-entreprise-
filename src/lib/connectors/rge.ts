import { env, isDemoMode, isRgeEnabled } from "@/lib/env";
import { odsFetch, odsText, odsToResult } from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Connecteur RGE — « Reconnu Garant de l'Environnement » (ADEME, jeu
 * `liste-des-entreprises-rge-2`, data-fair). Ouvert, SANS clé.
 *
 * Le jeu est au niveau ÉTABLISSEMENT (une ligne par établissement et par
 * qualification) : on rapproche par préfixe de SIRET = SIREN, puis chaque ligne
 * est re-vérifiée (si le filtre était ignoré par la source, la consultation est
 * traitée comme dégradée plutôt que de mélanger des entreprises).
 *
 * ⚠️ Une qualification RGE atteste d'une certification professionnelle ; son
 * absence n'est jamais un manquement.
 */
export type RgeLine = {
  siret: string;
  code: string | null;
  qualification: string | null;
  domain: string | null;
  /** Organisme de qualification (qualibat, certibat, afnor…). */
  body: string | null;
  from: string | null;
  to: string | null;
};

export type RgeRaw = {
  status: "ok" | "indisponible";
  /** Nombre total de lignes publiées pour ce SIREN (la liste est plafonnée). */
  total: number;
  lines: RgeLine[];
};

const DATASET = "liste-des-entreprises-rge-2";
const LIMIT = 100;
const SELECT = [
  "siret",
  "code_qualification",
  "nom_qualification",
  "meta_domaine",
  "organisme",
  "lien_date_debut",
  "lien_date_fin",
].join(",");

const empty = (): RgeRaw => ({ status: "indisponible", total: 0, lines: [] });
const day = (v: unknown): string | null => odsText(v)?.slice(0, 10) ?? null;

export const rge = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isRgeEnabled()) {
      return {
        raw: { status: "ok", total: 0, lines: [] } satisfies RgeRaw,
        endpoint: `fixture:rge:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (!/^\d{9}$/.test(siren)) {
      // Garde contre toute injection dans la requête `qs` : jamais interrogé.
      return {
        raw: { status: "ok", total: 0, lines: [] } satisfies RgeRaw,
        endpoint: "rge:siren-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const params = new URLSearchParams({
      qs: `siret:${siren}*`,
      size: String(LIMIT),
      select: SELECT,
      sort: "-lien_date_fin",
    });
    const url = `${env.ADEME_BASE_URL}/data-fair/api/v1/datasets/${DATASET}/lines?${params}`;
    return odsToResult<RgeRaw>(
      await odsFetch(url, "RGE"),
      url,
      (out) => {
        const lines = out.records.map<RgeLine>((r) => ({
          siret: odsText(r.siret) ?? "",
          code: odsText(r.code_qualification),
          qualification: odsText(r.nom_qualification),
          domain: odsText(r.meta_domaine),
          body: odsText(r.organisme),
          from: day(r.lien_date_debut),
          to: day(r.lien_date_fin),
        }));
        if (lines.some((l) => !l.siret.startsWith(siren))) {
          throw new Error("RGE: filtre SIREN ignoré par la source");
        }
        return { status: "ok", total: out.total, lines };
      },
      empty,
    );
  },
};
