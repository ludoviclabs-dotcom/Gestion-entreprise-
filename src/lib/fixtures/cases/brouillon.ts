import type { CaseBundle } from "@/lib/graph/graph-types";

/** Dossier brouillon minimal : créé « à la volée », pas encore enrichi (scores absents). */
export const brouillonBundle: CaseBundle = {
  case: {
    id: "brouillon-demo",
    title: "NEOTECH SOLUTIONS SAS",
    rootSiren: "904112233",
    // pas de scores : dossier en attente d'enrichissement
  },
  entities: [
    {
      id: "c1",
      type: "company",
      label: "NEOTECH SOLUTIONS SAS",
      evidenceLevel: "confirmed",
      attributes: {
        SIREN: "904 112 233",
        "Forme juridique": "SAS",
        État: "Active",
      },
      source: "INSEE Sirene — unité légale",
      excerpt: "Dossier créé, enrichissement non lancé.",
    },
  ],
  edges: [],
  events: [],
  riskSignals: [],
};
