import { REG, type RegRef } from "@/lib/domain/regulatory-refs";

/**
 * Contenu de la page /confidentialite — RGPD, base légale, rétention et
 * périmètre des conclusions. Source : docs/regulatory.md (sections RGPD,
 * CJUE 2022, garde-fous produit).
 */

export type LegalBasis = {
  title: string;
  body: string;
};

export const LEGAL_BASES: LegalBasis[] = [
  {
    title: "Obligation légale — art. 6.1.c RGPD",
    body: "Pour les entités assujetties LCB-FT (banques, notaires, comptables, agents immobiliers…), la vigilance est une obligation légale au titre du Code monétaire et financier.",
  },
  {
    title: "Intérêt légitime documenté — art. 6.1.f RGPD",
    body: "Pour les autres usages de due diligence, l'intérêt légitime est la base mobilisée. Conformément à l'arrêt CJUE du 22 novembre 2022, l'accès aux bénéficiaires effectifs nominatifs est conditionné à un intérêt légitime tracé dans le journal d'audit.",
  },
];

export type PrivacyPrinciple = {
  title: string;
  body: string;
};

export const PRIVACY_PRINCIPLES: PrivacyPrinciple[] = [
  {
    title: "Minimisation",
    body: "Aucune donnée stockée au-delà du nécessaire. En démonstration publique, seules des fixtures anonymisées sont affichées — aucun bénéficiaire effectif réel.",
  },
  {
    title: "Conservation — 5 ans",
    body: "Les dossiers d'analyse sont conservés cinq ans après la fin de la relation d'affaires, durée alignée sur les obligations du secteur financier et le paquet AML.",
  },
  {
    title: "Intégrité",
    body: "Chaque source porte un hachage SHA-256 horodaté ; la piste d'audit est chaînée et vérifiable hors ligne (Evidence Pack).",
  },
  {
    title: "Gating UBO (CJUE 2022)",
    body: "Le connecteur INPI récupère les bénéficiaires effectifs mais ne les expose dans le graphe que si INPI_EXPOSE_UBO=true (défaut : false), après authentification et enregistrement d'un intérêt légitime.",
  },
];

/** Section « Ce que KYB Graph ne conclut pas » — posture méthodologique. */
export const WHAT_WE_DONT_CONCLUDE: string[] = [
  "Le produit documente des signaux de vigilance, jamais une conclusion ; aucun vocabulaire accusatoire n'est employé.",
  "Une proximité de graphe n'établit pas une relation juridique ; elle doit être qualifiée par un agent habilité.",
  "La présomption d'innocence prévaut : aucune personne n'est désignée comme responsable d'une infraction.",
  "La décision finale reste humaine, contextualisée et conforme aux droits applicables.",
];

export type Guardrail = {
  measure: string;
  justification: string;
};

/** Garde-fous produit issus du cadre réglementaire (docs/regulatory.md). */
export const GUARDRAILS: Guardrail[] = [
  {
    measure: "Niveau de preuve obligatoire (4 paliers)",
    justification: "AMLR — traçabilité des éléments de vigilance.",
  },
  {
    measure: "Trail SHA-256 de chaque source",
    justification: "AMLR — conservation auditable ; RGPD — intégrité.",
  },
  {
    measure: "UBO derrière authentification + log d'intérêt légitime",
    justification: "CJUE 2022 (C-37/20, C-601/20).",
  },
  {
    measure: "Export PDF sourcé et horodaté",
    justification: "AMLR — opposabilité des décisions de vigilance.",
  },
  {
    measure: "Synthèse manuelle, zéro appel API tiers depuis la production",
    justification: "RGPD — aucun transfert hors UE des données du dossier.",
  },
];

/** Références mobilisées sur la page. */
export const PRIVACY_REFS: RegRef[] = [REG.RGPD, REG.CJUE_UBO, REG.AMLR];
