import { env, isDemoMode, isBoampEnabled } from "@/lib/env";
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
 * Connecteur BOAMP — Bulletin officiel des annonces des marchés publics (DILA,
 * jeu `boamp`, Opendatasoft). Ouvert, SANS clé.
 *
 * Rapprochement : le SIREN figure dans le corps de l'avis (`donnees`, JSON
 * brut) ; on ne retient que les **avis de résultat de marché** : un appel
 * d'offres ne prouve AUCUNE attribution. Le résultat dit « l'avis mentionne
 * l'entreprise » ; il ne désigne pas, à lui seul, un titulaire — les noms des
 * titulaires publiés sont repris tels quels pour lecture humaine.
 *
 * Précaution : libellés avec entités HTML (« d&#039;… ») décodés.
 */
export type BoampItem = {
  id: string;
  date: string | null;
  buyer: string | null;
  titulaires: string[];
  object: string | null;
  url: string | null;
};

export type BoampRaw = {
  status: "ok" | "indisponible";
  total: number;
  items: BoampItem[];
};

const DATASET = "boamp";
const LIMIT = 20;
const SELECT = [
  "idweb",
  "nomacheteur",
  "titulaire",
  "nature_libelle",
  "dateparution",
  "objet",
  "url_avis",
];

const empty = (): BoampRaw => ({ status: "indisponible", total: 0, items: [] });

export const boamp = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isBoampEnabled()) {
      return {
        raw: { status: "ok", total: 0, items: [] } satisfies BoampRaw,
        endpoint: `fixture:boamp:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const url = odsUrl({
      baseUrl: env.BOAMP_BASE_URL,
      dataset: DATASET,
      // Recherche du SIREN (9 chiffres, déjà validés) dans le corps de l'avis,
      // limitée aux avis de RÉSULTAT.
      where: `donnees like ${odsLiteral(`%${siren}%`)} and nature_libelle=${odsLiteral("Résultat de marché")}`,
      orderBy: "dateparution desc",
      select: SELECT,
      limit: LIMIT,
    });
    const outcome = await odsFetch(url, "BOAMP");
    return odsToResult<BoampRaw>(
      outcome,
      url,
      (out) => ({
        status: "ok",
        total: out.total,
        items: out.records.map((r) => ({
          id: odsText(r.idweb) ?? "",
          date: odsText(r.dateparution),
          buyer: odsText(r.nomacheteur) ? decodeEntities(odsText(r.nomacheteur) as string) : null,
          // Les titulaires sont parfois répétés (un par lot) : dédoublonnés.
          titulaires: [...new Set(textList(r.titulaire).map(decodeEntities))],
          object: odsText(r.objet) ? decodeEntities(odsText(r.objet) as string) : null,
          url: odsText(r.url_avis),
        })),
      }),
      empty,
    );
  },
};
