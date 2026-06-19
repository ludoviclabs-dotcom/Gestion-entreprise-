import type { CaseBundle } from "@/lib/graph/graph-types";

/**
 * Couverture médiatique défavorable (GDELT) : 4 articles à tonalité défavorable
 * + 2 neutres rattachés au sujet sur 5 mois. Illustre :
 *  - `COUVERTURE_MEDIA_DEFAVORABLE` (4 ≥ seuil 2 → medium, famille « media ») ;
 *  - la frise média + les badges « Presse / Presse — défavorable » de la timeline ;
 *  - faisceau convergent grâce à une 2ᵉ famille (adresse partagée avec une sœur).
 * La presse seule n'alarme JAMAIS (doctrine non-accusatoire) : ces événements
 * sont surfacés POUR EXAMEN, à corroborer. Données FICTIVES (titres inclus).
 */
export const adverseMediaBundle: CaseBundle = {
  case: {
    id: "orion-media",
    title: "ORION ÉNERGIE — couverture médiatique",
    rootSiren: "902345678",
    scores: { complexite: 27, vigilance: 51, qualitePreuve: 49 },
  },
  entities: [
    {
      id: "co:902345678",
      type: "company",
      label: "ORION ÉNERGIE SAS",
      evidenceLevel: "confirmed",
      attributes: {
        SIREN: "902 345 678",
        "Forme juridique": "SAS",
        "Activité (NAF)": "3511Z — Production d'électricité",
        Pays: "FR",
        État: "Active",
      },
      source: "INSEE Sirene — unité légale",
    },
    {
      id: "co:902345679",
      type: "company",
      label: "ORION TRADING SAS",
      evidenceLevel: "confirmed",
      attributes: {
        SIREN: "902 345 679",
        "Forme juridique": "SAS",
        Pays: "FR",
        État: "Active",
      },
      source: "INSEE Sirene — unité légale",
    },
    {
      id: "p:dg",
      type: "person",
      label: "Paul RIVIÈRE",
      evidenceLevel: "declared",
      attributes: { Qualité: "Président", Nationalité: "Française" },
      source: "INPI / RNE — dirigeants déclarés",
    },
    {
      id: "ad:orion",
      type: "address",
      label: "8 quai de Seine, 92000 Nanterre",
      evidenceLevel: "declared",
      attributes: { "Code postal": "92000", Commune: "Nanterre", Pays: "France" },
      source: "Base Adresse Nationale (BAN)",
    },
  ],
  edges: [
    {
      id: "g1",
      type: "DIRIGE",
      source: "p:dg",
      target: "co:902345678",
      label: "préside",
      evidenceLevel: "declared",
    },
    {
      id: "ad1",
      type: "PARTAGE_ADRESSE",
      source: "co:902345678",
      target: "ad:orion",
      label: "siège",
      evidenceLevel: "declared",
      sourceLabel: "INSEE Sirene — siège",
    },
    {
      id: "ad2",
      type: "PARTAGE_ADRESSE",
      source: "co:902345679",
      target: "ad:orion",
      label: "siège",
      evidenceLevel: "declared",
      sourceLabel: "INSEE Sirene — siège",
    },
  ],
  events: [
    {
      id: "ev:m1",
      entityId: "co:902345678",
      kind: "couverture_media_defavorable",
      title: "Enquête de presse sur des manquements environnementaux présumés",
      occurredOn: "2026-02-10",
      evidenceLevel: "inferred",
      source: "Presse (GDELT) — lemonde.fr",
    },
    {
      id: "ev:m2",
      entityId: "co:902345678",
      kind: "couverture_media_defavorable",
      title: "Plaintes de riverains relayées par la presse locale",
      occurredOn: "2026-03-05",
      evidenceLevel: "inferred",
      source: "Presse (GDELT) — sudouest.fr",
    },
    {
      id: "ev:m3",
      entityId: "co:902345678",
      kind: "couverture_media_defavorable",
      title: "Article critique sur la gouvernance du groupe",
      occurredOn: "2026-04-18",
      evidenceLevel: "inferred",
      source: "Presse (GDELT) — mediapart.fr",
    },
    {
      id: "ev:m4",
      entityId: "co:902345678",
      kind: "couverture_media_defavorable",
      title: "Couverture défavorable autour d'un litige commercial",
      occurredOn: "2026-05-22",
      evidenceLevel: "inferred",
      source: "Presse (GDELT) — lesechos.fr",
    },
    {
      id: "ev:m5",
      entityId: "co:902345678",
      kind: "couverture_media",
      title: "Annonce de l'ouverture d'un nouveau site de production",
      occurredOn: "2026-01-15",
      evidenceLevel: "inferred",
      source: "Presse (GDELT) — usinenouvelle.com",
    },
    {
      id: "ev:m6",
      entityId: "co:902345678",
      kind: "couverture_media",
      title: "Interview du dirigeant sur la transition énergétique",
      occurredOn: "2026-05-30",
      evidenceLevel: "inferred",
      source: "Presse (GDELT) — bfmtv.com",
    },
  ],
  riskSignals: [
    {
      id: "couverture-media-defavorable-orion",
      ruleId: "COUVERTURE_MEDIA_DEFAVORABLE",
      subjectId: "co:902345678",
      severity: "medium",
      category: "vigilance",
      explanation:
        "4 article(s) de presse à tonalité défavorable rattaché(s) à cette entité — à examiner (jamais une conclusion ; à corroborer par d'autres familles d'indices).",
    },
    {
      id: "adresse-partagee-orion",
      ruleId: "ADRESSE_PARTAGEE",
      subjectId: "ad:orion",
      severity: "medium",
      category: "vigilance",
      explanation: "2 sociétés déclarent la même adresse : 8 quai de Seine, 92000 Nanterre.",
    },
  ],
};
