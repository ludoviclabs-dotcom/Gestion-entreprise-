import { env, isDemoMode, isBaloEnabled } from "@/lib/env";
import {
  decodeEntities,
  odsFetch,
  odsLiteral,
  odsText,
  odsToResult,
  odsUrl,
  textList,
} from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Connecteur BALO — Bulletin des annonces légales obligatoires (DILA, jeu
 * `balo`, Opendatasoft). Ouvert, SANS clé. Rapprochement EXACT par SIREN : le
 * champ `siren` est une LISTE (une annonce peut viser plusieurs sociétés).
 *
 * ⚠️ Une annonce BALO (convocation, émission, comptes, fusion…) atteste d'une
 * PUBLICATION, jamais d'une relation de propriété ou de contrôle.
 */
export type BaloItem = {
  id: string;
  date: string | null;
  /** « Publications périodiques — Comptes annuels » (libellé lisible). */
  category: string | null;
  numero: string | null;
  names: string[];
  /** Autres SIREN visés par la même annonce (le sujet est exclu). */
  otherSirens: string[];
};

export type BaloRaw = {
  status: "ok" | "indisponible";
  /** Nombre total d'annonces pour ce SIREN (la liste est plafonnée). */
  total: number;
  items: BaloItem[];
};

const DATASET = "balo";
const LIMIT = 30;
const SELECT = [
  "id_annonce",
  "dateparution",
  "societes_noms",
  "siren",
  "numero_affaire",
  "facette_categorie_libelle",
];

const empty = (): BaloRaw => ({ status: "indisponible", total: 0, items: [] });

/** « PUBLICATIONS PERIODIQUES##Comptes annuels » → « Publications périodiques — Comptes annuels ». */
export function humanizeBaloCategory(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split("##")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const lower = p.toLowerCase();
      const looksUpper = p === p.toUpperCase();
      const text = looksUpper ? lower : p;
      return text.charAt(0).toUpperCase() + text.slice(1);
    });
  return parts.length > 0 ? parts.join(" — ") : null;
}

export const balo = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isBaloEnabled()) {
      return {
        raw: { status: "ok", total: 0, items: [] } satisfies BaloRaw,
        endpoint: `fixture:balo:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const url = odsUrl({
      baseUrl: env.DILA_JO_BASE_URL,
      dataset: DATASET,
      where: `siren=${odsLiteral(siren)}`,
      orderBy: "dateparution desc",
      select: SELECT,
      limit: LIMIT,
    });
    const outcome = await odsFetch(url, "BALO");
    return odsToResult<BaloRaw>(
      outcome,
      url,
      (out) => ({
        status: "ok",
        total: out.total,
        items: out.records.map((r) => ({
          id: odsText(r.id_annonce) ?? String(r.id_annonce ?? ""),
          date: odsText(r.dateparution),
          category: humanizeBaloCategory(odsText(r.facette_categorie_libelle)),
          numero: odsText(r.numero_affaire) ?? (r.numero_affaire != null ? String(r.numero_affaire) : null),
          names: textList(r.societes_noms).map(decodeEntities),
          otherSirens: textList(r.siren).filter((s) => s !== siren),
        })),
      }),
      empty,
    );
  },
};
