import { env, isDemoMode, isDcaEnabled, isJoafeEnabled } from "@/lib/env";
import {
  decodeEntities,
  odsFetch,
  odsLiteral,
  odsText,
  odsToResult,
  odsUrl,
} from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Associations, fondations et fonds de dotation — jeu `jo_associations` (DILA,
 * Opendatasoft), SANS clé. Un SEUL jeu réunit deux natures distinctes, séparées
 * par le champ `source` :
 *
 *  - `dca`   : dépôts de COMPTES annuels, rapprochés par SIREN (`dca_siren`) ;
 *  - `joafe` : ANNONCES du Journal officiel (création, modification,
 *              dissolution…), rapprochées par numéro RNA (`numero_rna`).
 *
 * Fondations et fonds de dotation (catégorie 9300) : leurs dépôts de comptes
 * (DCA) sont bien rapprochés par SIREN, mais leurs ANNONCES JOAFE ne portent
 * qu'un numéro RNF (`numrnf`, sans `numero_rna`) et aucune source accessible ne
 * relie ce numéro au SIREN (Recherche d'entreprises ne l'expose pas ; le texte
 * de l'annonce ne contient pas de SIREN). Rapprocher par le nom exposerait aux
 * homonymes — on n'interroge donc JOAFE que par RNA (« W » + 9 chiffres).
 *
 * ⚠️ L'absence de compte déposé ne signifie pas une irrégularité ; le contenu
 * d'une annonce ne déduit aucun dirigeant.
 */
export type AssociationItem = {
  id: string;
  date: string | null;
  /** DCA : date de clôture de l'exercice. */
  closedOn: string | null;
  /** JOAFE : « Création », « Modification », « Dissolution »… */
  type: string | null;
  state: string | null;
  category: string | null;
  title: string | null;
  titleNew: string | null;
  titleOld: string | null;
  rna: string | null;
};

export type AssociationsRaw = {
  status: "ok" | "indisponible";
  total: number;
  /** RNA lu dans les enregistrements (sert à interroger les annonces JOAFE). */
  rna: string | null;
  items: AssociationItem[];
};

const DATASET = "jo_associations";
const LIMIT = 20;
const SELECT = [
  "id",
  "source",
  "dateparution",
  "numero_rna",
  "titre",
  "titre_nouveau",
  "titre_ancien",
  "association_type_libelle",
  "typeavis",
  "etatavis",
  "dca_datecloture",
  "dca_datevalidation",
];

const empty = (): AssociationsRaw => ({ status: "indisponible", total: 0, rna: null, items: [] });
const okEmpty = (): AssociationsRaw => ({ status: "ok", total: 0, rna: null, items: [] });
const day = (v: unknown): string | null => {
  const s = odsText(v);
  return s ? s.slice(0, 10) : null;
};
const clean = (v: unknown): string | null => {
  const s = odsText(v);
  return s ? decodeEntities(s) : null;
};

function build(out: { total: number; records: Record<string, unknown>[] }): AssociationsRaw {
  const items = out.records.map<AssociationItem>((r) => ({
    id: odsText(r.id) ?? "",
    date: day(r.dca_datevalidation) ?? day(r.dateparution),
    closedOn: day(r.dca_datecloture),
    type: clean(r.typeavis),
    state: clean(r.etatavis),
    category: clean(r.association_type_libelle),
    title: clean(r.titre),
    titleNew: clean(r.titre_nouveau),
    titleOld: clean(r.titre_ancien),
    rna: odsText(r.numero_rna),
  }));
  return {
    status: "ok",
    total: out.total,
    rna: items.map((i) => i.rna).find((x): x is string => Boolean(x)) ?? null,
    items,
  };
}

/** RNA valide : « W » suivi de 9 chiffres (garde contre toute injection ODSQL). */
export const isRna = (v: string | null | undefined): v is string => /^W\d{9}$/.test(v ?? "");

export const dca = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isDcaEnabled()) {
      return {
        raw: okEmpty(),
        endpoint: `fixture:dca:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const url = odsUrl({
      baseUrl: env.DILA_JO_BASE_URL,
      dataset: DATASET,
      where: `source="dca" and dca_siren=${odsLiteral(siren)}`,
      orderBy: "dca_datecloture desc",
      select: SELECT,
      limit: LIMIT,
    });
    return odsToResult<AssociationsRaw>(await odsFetch(url, "DCA"), url, build, empty);
  },
};

export const joafe = {
  async byRna(rna: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isJoafeEnabled()) {
      return {
        raw: okEmpty(),
        endpoint: `fixture:joafe:${rna}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (!isRna(rna)) {
      // Numéro invalide : on n'interroge pas (aucune requête construite).
      return {
        raw: okEmpty(),
        endpoint: "joafe:rna-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const url = odsUrl({
      baseUrl: env.DILA_JO_BASE_URL,
      dataset: DATASET,
      where: `source="joafe" and numero_rna=${odsLiteral(rna)}`,
      orderBy: "dateparution desc",
      select: SELECT,
      limit: LIMIT,
    });
    return odsToResult<AssociationsRaw>(await odsFetch(url, "JOAFE"), url, build, empty);
  },
};
