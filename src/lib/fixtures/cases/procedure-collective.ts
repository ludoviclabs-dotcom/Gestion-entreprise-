import type { CaseBundle } from "@/lib/graph/graph-types";

/** Société en redressement judiciaire : événement BODACC + vigilance élevée. */
export const procedureCollectiveBundle: CaseBundle = {
  case: {
    id: "atlas-btp",
    title: "ATLAS BTP SARL",
    rootSiren: "789456123",
  },
  entities: [
    {
      id: "c1",
      type: "company",
      label: "ATLAS BTP SARL",
      evidenceLevel: "confirmed",
      attributes: {
        SIREN: "789 456 123",
        "Forme juridique": "SARL",
        "Activité (NAF)": "4120A — Construction de maisons individuelles",
        Création: "03/02/2015",
        État: "Active",
      },
      source: "INSEE Sirene — unité légale",
      excerpt: "Unité légale active, procédure collective en cours.",
    },
    {
      id: "p1",
      type: "person",
      label: "Marc LEROY",
      evidenceLevel: "declared",
      attributes: { Qualité: "Gérant", Nationalité: "Française" },
      source: "INPI / RNE — dirigeants déclarés",
      excerpt: "Gérant déclaré au RNE.",
    },
    {
      id: "a1",
      type: "address",
      label: "5 zone industrielle Les Chênes, 33700 Mérignac",
      evidenceLevel: "declared",
      attributes: { "Code postal": "33700", Commune: "Mérignac", Pays: "France" },
      source: "INSEE Sirene — adresse du siège",
      excerpt: "Siège social déclaré.",
    },
  ],
  edges: [
    {
      id: "e1",
      type: "DIRIGE",
      source: "p1",
      target: "c1",
      label: "gère",
      evidenceLevel: "declared",
      excerpt: "Gérant déclaré au RCS.",
    },
    {
      id: "e2",
      type: "PARTAGE_ADRESSE",
      source: "c1",
      target: "a1",
      label: "siège",
      evidenceLevel: "declared",
      excerpt: "Siège social déclaré à cette adresse.",
    },
  ],
  events: [
    {
      id: "ev1",
      entityId: "c1",
      kind: "procedure_collective",
      title: "Ouverture de redressement judiciaire (BODACC)",
      occurredOn: "2026-03-18",
      evidenceLevel: "confirmed",
      source: "BODACC — annonce du 18/03/2026",
    },
    {
      id: "ev2",
      entityId: "c1",
      kind: "creation",
      title: "Immatriculation RCS",
      occurredOn: "2015-02-03",
      evidenceLevel: "confirmed",
      source: "BODACC",
    },
  ],
  riskSignals: [], // recalculés du graphe par materializeCase (index)
};
