import type { CaseBundle } from "@/lib/graph/graph-types";

/**
 * Exposition sanctions via une chaîne de détention TRANSFRONTALIÈRE : une société
 * mère étrangère hors UE/EEE (référencée GLEIF) visée par un régime de gel
 * d'avoirs détient la société française sujet. Illustre :
 *  - `PROXIMITE_SANCTION` à 1 saut (la mère, high) ET à 2 sauts (le sujet, medium) ;
 *  - l'indicateur d'exposition transfrontalière hors-UE (Pays = VG) ;
 *  - l'opacité de détention (arête GLEIF sans % publié → ratio 100 %).
 * Données FICTIVES — aucune entité réelle. Vocabulaire non-accusatoire (faisceau).
 */
export const sanctionsTransfrontalierBundle: CaseBundle = {
  case: {
    id: "marengo-sanctions",
    title: "MARENGO FRANCE — exposition sanctions",
    rootSiren: "901234567",
    scores: { complexite: 46, vigilance: 84, qualitePreuve: 55 },
  },
  entities: [
    {
      id: "co:901234567",
      type: "company",
      label: "MARENGO FRANCE SAS",
      evidenceLevel: "confirmed",
      attributes: {
        SIREN: "901 234 567",
        "Forme juridique": "SAS",
        "Activité (NAF)": "4690Z — Commerce de gros",
        Pays: "FR",
        État: "Active",
      },
      source: "INSEE Sirene — unité légale",
    },
    {
      id: "co:lei:529900T8BM49AURSDO55",
      type: "company",
      label: "MARENGO HOLDING LTD",
      evidenceLevel: "declared",
      attributes: {
        LEI: "529900T8BM49AURSDO55",
        Pays: "VG", // Îles Vierges britanniques — hors UE/EEE
      },
      source: "GLEIF — société mère (niveau 2)",
      excerpt:
        "Société mère de consolidation déclarée au référentiel GLEIF (LEI).",
    },
    {
      id: "san:eu:marengo-holding",
      type: "sanction",
      label: "Correspondance « MARENGO HOLDING LTD » — gel d'avoirs (régime UE)",
      evidenceLevel: "confirmed",
      attributes: {
        Programme: "Gel d'avoirs (UE)",
        Référence: "Liste consolidée — annexe",
      },
      source: "OpenSanctions — liste consolidée UE",
      excerpt:
        "Entité figurant sur une liste de gel d'avoirs (donnée publique) — à confirmer sur les identifiants.",
    },
    {
      id: "p:dir1",
      type: "person",
      label: "Andrei VOLKOV",
      evidenceLevel: "declared",
      attributes: { Qualité: "Président" },
      source: "INPI / RNE — dirigeants déclarés",
    },
  ],
  edges: [
    {
      id: "d1",
      type: "DETIENT",
      source: "co:lei:529900T8BM49AURSDO55",
      target: "co:901234567",
      label: "mère ultime",
      evidenceLevel: "declared",
      excerpt:
        "Consolidation déclarée au référentiel GLEIF — sans pourcentage publié.",
    },
    {
      id: "s1",
      type: "EST_VISE_PAR",
      source: "co:lei:529900T8BM49AURSDO55",
      target: "san:eu:marengo-holding",
      label: "visée par",
      evidenceLevel: "confirmed",
      excerpt:
        "Rapprochement avec une liste de gel d'avoirs — à confirmer sur les identifiants (références UE/ONU).",
    },
    {
      id: "g1",
      type: "DIRIGE",
      source: "p:dir1",
      target: "co:901234567",
      label: "préside",
      evidenceLevel: "declared",
    },
  ],
  events: [],
  riskSignals: [
    {
      id: "proximite-sanction-holding",
      ruleId: "PROXIMITE_SANCTION",
      subjectId: "co:lei:529900T8BM49AURSDO55",
      severity: "high",
      category: "vigilance",
      explanation:
        "MARENGO HOLDING LTD est directement reliée à une entité signalée (sanction/PEP). Homonymie possible — à vérifier sur les identifiants (références UE/ONU).",
    },
    {
      id: "proximite-sanction-sujet",
      ruleId: "PROXIMITE_SANCTION",
      subjectId: "co:901234567",
      severity: "medium",
      category: "vigilance",
      explanation:
        "MARENGO FRANCE SAS est à 2 sauts d'une entité signalée (sanction/PEP), via sa société mère MARENGO HOLDING LTD (mère ultime).",
    },
  ],
};
