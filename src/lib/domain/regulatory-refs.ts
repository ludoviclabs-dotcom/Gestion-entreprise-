/**
 * Références réglementaires canoniques — source de vérité unique, datée et liée.
 *
 * Réutilisé par les pages publiques /ressources, /souverainete et /confidentialite
 * (composant `RegulatoryAnchor`). Mêmes conventions que `OfficialSource` de
 * `sector-threats.ts`, enrichies d'une date et d'une catégorie.
 *
 * ⚠️ Aucun vocabulaire accusatoire ici (cf. garde-fou produit + tests unitaires).
 */
export type RegRef = {
  /** Libellé affiché (texte + numéro officiel). */
  label: string;
  /** URL vers le texte officiel (EUR-Lex, Légifrance, ANSSI, FATF, curia…). */
  url: string;
  /** Date de référence (publication / décision / qualification), format libre court. */
  date: string;
  /** Regroupement pour la page Ressources. */
  category: RegCategory;
  /** Précision facultative (ce que le texte établit). */
  note?: string;
};

export type RegCategory =
  | "UE — paquet AML"
  | "France — CMF / LCB-FT"
  | "FATF / GAFI"
  | "Souveraineté / ANSSI"
  | "Jurisprudence / RGPD";

export const REG = {
  AMLR: {
    label: "Règlement (UE) 2024/1624 — AMLR",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1624",
    date: "19 juin 2024 (applicable le 10 juillet 2027)",
    category: "UE — paquet AML",
    note: "Single rulebook LCB-FT. Seuil bénéficiaire effectif harmonisé à 25 %, piste d'audit obligatoire.",
  },
  AMLD6: {
    label: "Directive (UE) 2024/1640 — AMLD6",
    url: "https://eur-lex.europa.eu/eli/dir/2024/1640",
    date: "19 juin 2024",
    category: "UE — paquet AML",
    note: "Bascule du seuil UBO à « 25 % ou plus », abaissable à 15 % pour les secteurs à haut risque.",
  },
  AMLA: {
    label: "Règlement (UE) 2024/1620 — AMLA",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1620",
    date: "opérationnelle depuis le 1er juillet 2025 (Francfort)",
    category: "UE — paquet AML",
    note: "Autorité européenne LCB-FT ; supervision directe à compter de 2028.",
  },
  CMF_L561_2: {
    label: "Code monétaire et financier, art. L.561-2",
    url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072026",
    date: "en vigueur",
    category: "France — CMF / LCB-FT",
    note: "Liste des entités assujetties aux obligations de vigilance LCB-FT.",
  },
  CMF_L561_5: {
    label: "Code monétaire et financier, art. L.561-5",
    url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072026",
    date: "en vigueur",
    category: "France — CMF / LCB-FT",
    note: "Identification du client et du bénéficiaire effectif.",
  },
  CMF_L561_15: {
    label: "Code monétaire et financier, art. L.561-15",
    url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072026",
    date: "en vigueur",
    category: "France — CMF / LCB-FT",
    note: "Déclaration de soupçon à Tracfin.",
  },
  CMF_L561_46: {
    label: "Code monétaire et financier, art. L.561-46",
    url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072026",
    date: "en vigueur",
    category: "France — CMF / LCB-FT",
    note: "Données du registre des bénéficiaires effectifs accessibles et conditions d'accès.",
  },
  TRACFIN: {
    label: "Tracfin — rapports d'activité et d'analyse",
    url: "https://www.economie.gouv.fr/tracfin/les-publications-de-tracfin/les-rapports-dactivite-et-danalyse",
    date: "2024 : 211 165 déclarations de soupçon",
    category: "France — CMF / LCB-FT",
    note: "Cellule de renseignement financier française (art. L.561-23 CMF).",
  },
  FATF_R24: {
    label: "GAFI — Recommandation 24 (personnes morales)",
    url: "https://www.fatf-gafi.org/en/topics/beneficial-ownership.html",
    date: "révisée mars 2022 (guidance mars 2023)",
    category: "FATF / GAFI",
    note: "Information sur les bénéficiaires effectifs « adequate, accurate and up-to-date ».",
  },
  FATF_R25: {
    label: "GAFI — Recommandation 25 (constructions juridiques)",
    url: "https://www.fatf-gafi.org/en/topics/beneficial-ownership.html",
    date: "révisée février 2023 (guidance mars 2024)",
    category: "FATF / GAFI",
    note: "Transparence des trusts et constructions juridiques assimilées.",
  },
  CJUE_UBO: {
    label: "CJUE, 22 nov. 2022, C-37/20 et C-601/20 (WM / Sovim)",
    url: "https://curia.europa.eu/juris/liste.jsf?num=C-37/20",
    date: "22 novembre 2022",
    category: "Jurisprudence / RGPD",
    note: "Invalide la publicité du registre des bénéficiaires effectifs → accès conditionné à l'intérêt légitime.",
  },
  RGPD: {
    label: "Règlement (UE) 2016/679 — RGPD",
    url: "https://eur-lex.europa.eu/eli/reg/2016/679",
    date: "applicable depuis le 25 mai 2018",
    category: "Jurisprudence / RGPD",
    note: "Finalité, minimisation, intérêt légitime (art. 6.1.f), conservation limitée.",
  },
  SECNUMCLOUD: {
    label: "Référentiel SecNumCloud 3.2 (ANSSI)",
    url: "https://cyber.gouv.fr/secnumcloud",
    date: "mars 2022",
    category: "Souveraineté / ANSSI",
    note: "Hébergement UE, immunité aux lois extracommunautaires (CLOUD Act / FISA), capitaux européens majoritaires.",
  },
  CLOUD_AU_CENTRE: {
    label: "Circulaire n° 6404/SG « Cloud au centre »",
    url: "https://www.numerique.gouv.fr/publications/doctrine-cloud-au-centre/",
    date: "31 mai 2023",
    category: "Souveraineté / ANSSI",
    note: "Doctrine d'hébergement des données sensibles de l'État sur cloud qualifié.",
  },
  SREN_ART31: {
    label: "Loi n° 2024-449 (SREN), art. 31",
    url: "https://www.vie-publique.fr/loi/289065-loi-sren-21-mai-2024-espace-numerique",
    date: "21 mai 2024",
    category: "Souveraineté / ANSSI",
    note: "Impose un hébergement qualifié SecNumCloud pour certaines données sensibles de l'administration.",
  },
} as const satisfies Record<string, RegRef>;

export type RegKey = keyof typeof REG;
