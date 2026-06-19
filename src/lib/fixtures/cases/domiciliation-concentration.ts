import type { CaseBundle, CaseEntity, CaseEdge } from "@/lib/graph/graph-types";

/**
 * Hub de domiciliation : 9 sociétés déclarent la même adresse de siège, dont une
 * créée récemment, et une même gérante en dirige trois. Illustre :
 *  - `ADRESSE_PARTAGEE` (9 ≥ seuil high 5 → high) ;
 *  - `CONCENTRATION_DOMICILIATION` (≥ 3 sociétés + une récente → medium) ;
 *  - `DIRIGEANT_MULTI_SOCIETES` (gérante de 3 sociétés → medium) ;
 *  - faisceau convergent : 2 familles distinctes (adresse + gouvernance).
 * Données FICTIVES. Vocabulaire non-accusatoire : « domiciliation à vérifier ».
 */
const ADDRESS_ID = "ad:hub-commerce";
const ADDRESS_LABEL = "12 rue du Commerce, 75015 Paris";
const NAMES = [
  "MERCURE",
  "VÉNUS",
  "MARS",
  "JUPITER",
  "SATURNE",
  "NEPTUNE",
  "URANUS",
  "CÉRÈS",
  "VESTA",
];

const companies: CaseEntity[] = NAMES.map((name, i): CaseEntity => {
  const siren = `8010000${(10 + i).toString()}`; // 9 chiffres, fictif
  return {
    id: `co:${siren}`,
    type: "company",
    label: `${name} TRADING SAS`,
    evidenceLevel: "confirmed",
    attributes: {
      SIREN: `${siren.slice(0, 3)} ${siren.slice(3, 6)} ${siren.slice(6, 9)}`,
      "Forme juridique": "SAS",
      Pays: "FR",
      État: "Active",
      // La première société est créée récemment (déclenche le critère de récence).
      ...(i === 0 ? { Création: "12/02/2026" } : { Création: "05/06/2019" }),
    },
    source: "INSEE Sirene — unité légale",
  };
});

const address: CaseEntity = {
  id: ADDRESS_ID,
  type: "address",
  label: ADDRESS_LABEL,
  evidenceLevel: "declared",
  attributes: { "Code postal": "75015", Commune: "Paris", Pays: "France" },
  source: "Base Adresse Nationale (BAN)",
  excerpt: "Adresse de siège normalisée (BAN) — partagée par plusieurs sociétés.",
};

const gerante: CaseEntity = {
  id: "p:gerante",
  type: "person",
  label: "Léa FONTAINE",
  evidenceLevel: "declared",
  attributes: { Qualité: "Gérante", Nationalité: "Française" },
  source: "INPI / RNE — dirigeants déclarés",
};

const edges: CaseEdge[] = [
  ...companies.map(
    (c, i): CaseEdge => ({
      id: `ad${i + 1}`,
      type: "PARTAGE_ADRESSE",
      source: c.id,
      target: ADDRESS_ID,
      label: "siège",
      evidenceLevel: "declared",
      sourceLabel: "INSEE Sirene — siège",
    }),
  ),
  // La même gérante dirige trois des sociétés (2ᵉ famille d'indices).
  ...companies.slice(0, 3).map(
    (c, i): CaseEdge => ({
      id: `g${i + 1}`,
      type: "DIRIGE",
      source: "p:gerante",
      target: c.id,
      label: "gère",
      evidenceLevel: "declared",
    }),
  ),
];

export const domiciliationConcentrationBundle: CaseBundle = {
  case: {
    id: "hub-domiciliation",
    title: "Hub de domiciliation — 9 sociétés",
    rootSiren: "801000010",
    scores: { complexite: 73, vigilance: 64, qualitePreuve: 60 },
  },
  entities: [...companies, address, gerante],
  edges,
  events: [
    {
      id: "ev:creation-recente",
      entityId: "co:801000010",
      kind: "creation",
      title: "Immatriculation RCS",
      occurredOn: "2026-02-12",
      evidenceLevel: "confirmed",
      source: "BODACC",
    },
  ],
  riskSignals: [
    {
      id: "adresse-partagee-hub",
      ruleId: "ADRESSE_PARTAGEE",
      subjectId: ADDRESS_ID,
      severity: "high",
      category: "vigilance",
      explanation: `9 sociétés déclarent la même adresse : ${ADDRESS_LABEL}.`,
    },
    {
      id: "concentration-domiciliation-hub",
      ruleId: "CONCENTRATION_DOMICILIATION",
      subjectId: ADDRESS_ID,
      severity: "medium",
      category: "vigilance",
      explanation: `9 sociétés domiciliées à la même adresse (${ADDRESS_LABEL}), dont au moins une récente — domiciliation à vérifier.`,
    },
    {
      id: "dirigeant-multi-societes-gerante",
      ruleId: "DIRIGEANT_MULTI_SOCIETES",
      subjectId: "p:gerante",
      severity: "medium",
      category: "complexite",
      explanation: "Léa FONTAINE est lié·e à 3 sociétés du dossier (seuil 3).",
    },
  ],
};
