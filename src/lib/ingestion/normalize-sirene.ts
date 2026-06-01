import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import { slugify } from "@/lib/text";

type SirenePeriode = {
  denominationUniteLegale?: string | null;
  categorieJuridiqueUniteLegale?: string | null;
  activitePrincipaleUniteLegale?: string | null;
  etatAdministratifUniteLegale?: string | null;
};
type SireneUniteLegale = {
  siren?: string;
  dateCreationUniteLegale?: string | null;
  nicSiegeUniteLegale?: string | null;
  periodesUniteLegale?: SirenePeriode[];
};
type SireneULResponse = { uniteLegale?: SireneUniteLegale };

type SireneAdresse = {
  numeroVoieEtablissement?: string | null;
  typeVoieEtablissement?: string | null;
  libelleVoieEtablissement?: string | null;
  codePostalEtablissement?: string | null;
  libelleCommuneEtablissement?: string | null;
};
type SireneEtabResponse = {
  etablissement?: { adresseEtablissement?: SireneAdresse };
};

const FORMES: Record<string, string> = {
  "5710": "SA",
  "5499": "SARL",
  "5599": "SAS",
  "5202": "SNC",
  "6540": "SCI",
};
const ETATS: Record<string, string> = { A: "Active", C: "Cessée" };

export type SireneNormalized = {
  siren: string;
  companyId: string;
  denomination: string | null;
  nic: string | null;
  entities: CaseEntity[];
  edges: CaseEdge[];
};

export function normalizeSirene(
  uniteLegaleRaw: unknown,
  etabRaw: unknown,
): SireneNormalized {
  const ul = (uniteLegaleRaw as SireneULResponse).uniteLegale ?? {};
  const siren = ul.siren ?? "";
  const period = ul.periodesUniteLegale?.[0] ?? {};
  const denomination = period.denominationUniteLegale ?? null;
  const forme = period.categorieJuridiqueUniteLegale
    ? (FORMES[period.categorieJuridiqueUniteLegale] ??
      period.categorieJuridiqueUniteLegale)
    : null;
  const companyId = `co:${siren}`;

  const companyAttrs: Record<string, string> = {};
  if (siren) companyAttrs["SIREN"] = siren;
  if (forme) companyAttrs["Forme juridique"] = forme;
  if (period.activitePrincipaleUniteLegale)
    companyAttrs["Activité (NAF)"] = period.activitePrincipaleUniteLegale;
  if (ul.dateCreationUniteLegale)
    companyAttrs["Création"] = ul.dateCreationUniteLegale;
  if (period.etatAdministratifUniteLegale)
    companyAttrs["État"] =
      ETATS[period.etatAdministratifUniteLegale] ??
      period.etatAdministratifUniteLegale;

  const entities: CaseEntity[] = [
    {
      id: companyId,
      type: "company",
      label: denomination ?? `SIREN ${siren}`,
      evidenceLevel: "confirmed",
      attributes: companyAttrs,
      source: "INSEE Sirene — unité légale",
      excerpt: "Unité légale issue du répertoire Sirene.",
    },
  ];
  const edges: CaseEdge[] = [];

  const adr = (etabRaw as SireneEtabResponse).etablissement?.adresseEtablissement;
  if (adr) {
    const ligne = [
      adr.numeroVoieEtablissement,
      adr.typeVoieEtablissement,
      adr.libelleVoieEtablissement,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    const commune = [adr.codePostalEtablissement, adr.libelleCommuneEtablissement]
      .filter(Boolean)
      .join(" ");
    const label = [ligne, commune].filter(Boolean).join(", ");
    if (label) {
      const addressId = `ad:${slugify(label)}`;
      const addrAttrs: Record<string, string> = { Pays: "France" };
      if (adr.codePostalEtablissement)
        addrAttrs["Code postal"] = adr.codePostalEtablissement;
      if (adr.libelleCommuneEtablissement)
        addrAttrs["Commune"] = adr.libelleCommuneEtablissement;
      entities.push({
        id: addressId,
        type: "address",
        label,
        evidenceLevel: "declared",
        attributes: addrAttrs,
        source: "INSEE Sirene — adresse du siège",
        excerpt: "Adresse du siège déclarée.",
      });
      edges.push({
        id: `e:${companyId}:${addressId}`,
        type: "PARTAGE_ADRESSE",
        source: companyId,
        target: addressId,
        label: "siège",
        evidenceLevel: "declared",
        excerpt: "Siège social déclaré à cette adresse.",
      });
    }
  }

  return {
    siren,
    companyId,
    denomination,
    nic: ul.nicSiegeUniteLegale ?? null,
    entities,
    edges,
  };
}
