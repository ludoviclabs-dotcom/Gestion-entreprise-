import type { CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type { BanAddress } from "@/lib/connectors/ban";
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

/**
 * Libellés NAF/APE des codes les plus fréquents (lisibilité). La nomenclature
 * NAF 2025 fait évoluer ces codes au 1ᵉʳ janvier 2027 : enrichir alors la table
 * de correspondance (anticipation de format). Fallback : code brut.
 */
const NAF_LABELS: Record<string, string> = {
  "1051A": "Fabrication de lait liquide et de produits frais",
  "6420Z": "Activités des sociétés holding",
  "7010Z": "Activités des sièges sociaux",
  "7022Z": "Conseil pour les affaires et autres conseils de gestion",
  "6810Z": "Activités des marchands de biens immobiliers",
  "6820A": "Location de logements",
  "6831Z": "Agences immobilières",
};

/** Libellé NAF « code — intitulé » si connu, sinon le code brut. */
function nafLabel(code: string): string {
  const key = code.replace(/[.\s]/g, "").toUpperCase();
  return NAF_LABELS[key] ? `${code} — ${NAF_LABELS[key]}` : code;
}

/** Adresse du siège extraite de la réponse établissement Sirene (libellé + composants). */
export type SireneAddress = {
  label: string;
  postcode: string | null;
  city: string | null;
};

export function sireneAddress(etabRaw: unknown): SireneAddress | null {
  const adr = (etabRaw as SireneEtabResponse).etablissement?.adresseEtablissement;
  if (!adr) return null;
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
  if (!label) return null;
  return {
    label,
    postcode: adr.codePostalEtablissement ?? null,
    city: adr.libelleCommuneEtablissement ?? null,
  };
}

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
  banAddress?: BanAddress | null,
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
    companyAttrs["Activité (NAF)"] = nafLabel(period.activitePrincipaleUniteLegale);
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

  const sa = sireneAddress(etabRaw);
  if (sa) {
    // BAN prioritaire si le géocodage est confiant : clé d'adresse CANONIQUE
    // (deux sociétés au même lieu → même nœud) + coordonnées. Sinon repli sur le
    // slug du libellé Sirene (comportement historique).
    const useBan = banAddress != null && banAddress.score >= 0.5;
    const addressId = useBan ? `ad:ban:${banAddress.id}` : `ad:${slugify(sa.label)}`;
    const label = useBan && banAddress.label ? banAddress.label : sa.label;
    const postcode = (useBan ? banAddress.postcode : sa.postcode) ?? sa.postcode;
    const city = (useBan ? banAddress.city : sa.city) ?? sa.city;
    const addrAttrs: Record<string, string> = { Pays: "France" };
    if (postcode) addrAttrs["Code postal"] = postcode;
    if (city) addrAttrs["Commune"] = city;
    if (useBan && banAddress.lat != null && banAddress.lon != null) {
      addrAttrs["Coordonnées"] = `${banAddress.lat.toFixed(5)}, ${banAddress.lon.toFixed(5)}`;
      addrAttrs["Référence BAN"] = banAddress.id;
    }
    entities.push({
      id: addressId,
      type: "address",
      label,
      evidenceLevel: "declared",
      attributes: addrAttrs,
      source: useBan
        ? "Base Adresse Nationale (siège normalisé)"
        : "INSEE Sirene — adresse du siège",
      excerpt: useBan
        ? "Adresse du siège normalisée via la Base Adresse Nationale."
        : "Adresse du siège déclarée.",
    });
    edges.push({
      id: `e:${companyId}:${addressId}`,
      type: "PARTAGE_ADRESSE",
      source: companyId,
      target: addressId,
      label: "siège",
      evidenceLevel: "declared",
      // Le LIEN « siège » est déclaré au Sirene (même si le NŒUD adresse est
      // normalisé par la BAN) → provenance Sirene pour l'inspecteur de preuve.
      sourceLabel: "INSEE Sirene — siège",
      excerpt: "Siège social déclaré à cette adresse.",
    });
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
