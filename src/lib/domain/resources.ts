import { REG, type RegRef, type RegCategory } from "@/lib/domain/regulatory-refs";

/**
 * Contenu de la page /ressources — ancrages réglementaires datés et liés,
 * regroupés par catégorie. Réutilise les références canoniques de
 * regulatory-refs.ts (mêmes URLs que celles déjà citées dans sector-threats.ts
 * et docs/regulatory.md).
 */

export type ResourceGroup = {
  category: RegCategory;
  intro: string;
  refs: RegRef[];
};

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    category: "UE — paquet AML",
    intro:
      "Le paquet anti-blanchiment 2024 : règles directement applicables, autorité de supervision et nouveau seuil de bénéficiaire effectif.",
    refs: [REG.AMLR, REG.AMLD6, REG.AMLA],
  },
  {
    category: "France — CMF / LCB-FT",
    intro:
      "Obligations françaises de vigilance, identification du bénéficiaire effectif, déclaration de soupçon et cellule de renseignement financier.",
    refs: [
      REG.CMF_L561_2,
      REG.CMF_L561_5,
      REG.CMF_L561_15,
      REG.CMF_L561_46,
      REG.TRACFIN,
    ],
  },
  {
    category: "FATF / GAFI",
    intro:
      "Standards internationaux sur la transparence des bénéficiaires effectifs des personnes morales et des constructions juridiques.",
    refs: [REG.FATF_R24, REG.FATF_R25],
  },
  {
    category: "Souveraineté / ANSSI",
    intro:
      "Doctrine d'hébergement souverain et qualification SecNumCloud — cadre de la trajectoire d'hébergement de KYB Graph.",
    refs: [REG.CLOUD_AU_CENTRE, REG.SECNUMCLOUD, REG.SREN_ART31],
  },
  {
    category: "Jurisprudence / RGPD",
    intro:
      "Décision encadrant l'accès au registre des bénéficiaires effectifs et base de protection des données personnelles.",
    refs: [REG.CJUE_UBO, REG.RGPD],
  },
];
