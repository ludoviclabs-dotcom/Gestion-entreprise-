import type { CaseBundle } from "@/lib/graph/graph-types";

/** Dossier « propre » : 1 société active, dirigeant unique, aucun signal élevé. */
export const cleanCompanyBundle: CaseBundle = {
  case: {
    id: "innovatech",
    title: "INNOVATECH SAS",
    rootSiren: "843291567",
  },
  entities: [
    {
      id: "c1",
      type: "company",
      label: "INNOVATECH SAS",
      evidenceLevel: "confirmed",
      attributes: {
        SIREN: "843 291 567",
        "Forme juridique": "SAS",
        "Activité (NAF)": "6201Z — Programmation informatique",
        Création: "12/04/2019",
        État: "Active",
      },
      source: "INSEE Sirene — unité légale",
      excerpt: "Unité légale active, situation régulière.",
    },
    {
      id: "p1",
      type: "person",
      label: "Claire DUBOIS",
      evidenceLevel: "declared",
      attributes: { Qualité: "Présidente", Nationalité: "Française" },
      source: "INPI / RNE — dirigeants déclarés",
      excerpt: "Dirigeante unique déclarée au RNE.",
    },
    {
      id: "a1",
      type: "address",
      label: "24 rue de la République, 69002 Lyon",
      evidenceLevel: "declared",
      attributes: { "Code postal": "69002", Commune: "Lyon", Pays: "France" },
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
      label: "préside",
      evidenceLevel: "declared",
      excerpt: "Présidente déclarée au RCS.",
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
      kind: "creation",
      title: "Immatriculation RCS",
      occurredOn: "2019-04-12",
      evidenceLevel: "confirmed",
      source: "BODACC",
    },
  ],
  riskSignals: [],
};
