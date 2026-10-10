import { env, isDemoMode, isQualiopiEnabled } from "@/lib/env";
import {
  odsFetch,
  odsLiteral,
  odsText,
  odsToResult,
  odsUrl,
} from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Connecteur « liste publique des organismes de formation » (DGEFP, jeu
 * `liste-publique-des-of-v2`, Opendatasoft). Ouvert, SANS clé. Rapprochement
 * EXACT par SIREN. Le jeu porte, pour chaque déclaration d'activité, les
 * catégories d'actions certifiées Qualiopi.
 *
 * ⚠️ Être déclaré organisme de formation ou certifié Qualiopi atteste d'une
 * qualification ; ne pas l'être n'est jamais un manquement.
 */
export type QualiopiOrganisation = {
  /** Numéro de déclaration d'activité (NDA). */
  nda: string | null;
  name: string | null;
  siret: string | null;
  /** Catégories d'actions certifiées (vide : déclaré sans certification). */
  categories: string[];
};

export type QualiopiRaw = {
  status: "ok" | "indisponible";
  total: number;
  organisations: QualiopiOrganisation[];
};

const DATASET = "liste-publique-des-of-v2";
const LIMIT = 10;
const SELECT = [
  "numerodeclarationactivite",
  "denomination",
  "siren",
  "siretetablissementdeclarant",
  "certifications_actionsdeformation",
  "certifications_bilansdecompetences",
  "certifications_vae",
  "certifications_actionsdeformationparapprentissage",
];

/** Colonnes booléennes (texte « true »/« false ») → libellé de la catégorie. */
const CATEGORIES: [string, string][] = [
  ["certifications_actionsdeformation", "actions de formation"],
  ["certifications_bilansdecompetences", "bilans de compétences"],
  ["certifications_vae", "VAE"],
  ["certifications_actionsdeformationparapprentissage", "actions de formation par apprentissage"],
];

const empty = (): QualiopiRaw => ({ status: "indisponible", total: 0, organisations: [] });
const isTrue = (v: unknown): boolean => v === true || v === "true";

export const qualiopi = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isQualiopiEnabled()) {
      return {
        raw: { status: "ok", total: 0, organisations: [] } satisfies QualiopiRaw,
        endpoint: `fixture:qualiopi:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (!/^\d{9}$/.test(siren)) {
      return {
        raw: { status: "ok", total: 0, organisations: [] } satisfies QualiopiRaw,
        endpoint: "qualiopi:siren-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const url = odsUrl({
      baseUrl: env.DGEFP_BASE_URL,
      dataset: DATASET,
      where: `siren=${odsLiteral(siren)}`,
      select: SELECT,
      limit: LIMIT,
    });
    return odsToResult<QualiopiRaw>(
      await odsFetch(url, "QUALIOPI"),
      url,
      (out) => ({
        status: "ok",
        total: out.total,
        organisations: out.records.map<QualiopiOrganisation>((r) => ({
          nda: odsText(r.numerodeclarationactivite),
          name: odsText(r.denomination),
          siret: odsText(r.siretetablissementdeclarant),
          categories: CATEGORIES.filter(([col]) => isTrue(r[col])).map(([, label]) => label),
        })),
      }),
      empty,
    );
  },
};
