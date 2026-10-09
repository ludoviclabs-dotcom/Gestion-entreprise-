import type { SourceRecord } from "./schema";

/**
 * Registre des sources réelles des parcours du Lab.
 *
 * Repris du document de cadrage (§13.1, recherche du 9 octobre 2026). Chaque
 * fiche dit ce que la source permet d'affirmer et ses limites de lecture. Les
 * règles opérationnelles doivent être relues sur la version consolidée des
 * textes : une fiche oriente, elle ne remplace pas le texte.
 *
 * Politique (§2.3) : les textes et publications d'autorités établissent ;
 * presse et études de cabinets orientent une recherche et ne valent jamais
 * confirmation indépendante.
 */
const CONSULTED = "2026-10-09";

export const LEARNING_SOURCES = {
  "amf-mica": {
    id: "amf-mica",
    kind: "publication_autorite",
    title: "Dossier thématique MiCA",
    publisher: "AMF",
    url: "https://www.amf-france.org/fr/actualites-publications/dossiers-thematiques/mica",
    consultedOn: CONSULTED,
    supports: "Cadre européen des cryptoactifs et rôle de l'AMF dans son application en France.",
    limits: "Consulté par extraits officiels ; lecture intégrale non obtenue.",
  },
  "esma-qualification": {
    id: "esma-qualification",
    kind: "publication_autorite",
    title: "Guidelines on the qualification of crypto-assets as financial instruments",
    publisher: "ESMA",
    url: "https://www.esma.europa.eu/sites/default/files/2025-03/ESMA75453128700-1323_Guidelines_on_the_conditions_and_criteria_for_the_qualification_of_CAs_as_FIs.pdf",
    published: "2025-03",
    consultedOn: CONSULTED,
    supports:
      "Critères de fond pour qualifier un cryptoactif d'instrument financier, y compris le cas des NFT.",
  },
  "amf-transition-mica": {
    id: "amf-transition-mica",
    kind: "publication_autorite",
    title: "Fin de la période de transition entre la loi PACTE et le règlement MiCA",
    publisher: "AMF",
    url: "https://www.amf-france.org/fr/actualites-publications/communiques/communiques-de-lamf/crypto-actifs-la-fin-de-la-periode-de-transition-entre-la-loi-pacte-et-le-reglement-europeen-mica",
    consultedOn: CONSULTED,
    supports:
      "Échéance française du 1er juillet 2026 : un ancien enregistrement PSAN ne vaut plus agrément MiCA.",
    limits: "Extraits officiels consultés.",
  },
  "esma-mica-registres": {
    id: "esma-mica-registres",
    kind: "publication_autorite",
    title: "MiCA : registres et article 60",
    publisher: "ESMA",
    url: "https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica",
    consultedOn: CONSULTED,
    supports:
      "Vérification du statut d'un prestataire et régime de notification de certains établissements financiers.",
  },
  "eba-travel-rule": {
    id: "eba-travel-rule",
    kind: "publication_autorite",
    title: "Travel Rule Guidelines (règlement 2023/1113)",
    publisher: "EBA",
    url: "https://www.eba.europa.eu/publications-and-media/press-releases/eba-issues-travel-rule-guidance-tackle-money-laundering-and-terrorist-financing-transfers-funds-and",
    published: "2024-07",
    consultedOn: CONSULTED,
    supports:
      "Informations qui doivent accompagner les transferts de cryptoactifs dans le champ du règlement, applicables depuis le 30 décembre 2024.",
  },
  "ethereum-accounts": {
    id: "ethereum-accounts",
    kind: "documentation_technique",
    title: "Ethereum accounts",
    publisher: "ethereum.org",
    url: "https://ethereum.org/developers/docs/accounts/",
    consultedOn: CONSULTED,
    supports: "Distinction entre compte détenu par une clé, contrat et logiciel de portefeuille.",
  },
  "bitcoin-transactions": {
    id: "bitcoin-transactions",
    kind: "documentation_technique",
    title: "Bitcoin developer guide : transactions",
    publisher: "bitcoin.org",
    url: "https://developer.bitcoin.org/devguide/transactions.html",
    consultedOn: CONSULTED,
    supports: "Modèle UTXO : une transaction consomme des entrées et crée des sorties.",
  },
  "gafi-red-flags": {
    id: "gafi-red-flags",
    kind: "publication_autorite",
    title: "Virtual Assets Red Flag Indicators",
    publisher: "GAFI",
    url: "https://www.fatf-gafi.org/en/publications/Methodsandtrends/Virtual-assets-red-flag-indicators.html",
    published: "2020-09",
    consultedOn: CONSULTED,
    supports: "Indicateurs qui orientent une vérification sur les actifs virtuels.",
    limits: "Un indicateur isolé ne démontre ni blanchiment ni financement du terrorisme.",
  },
  "gafi-2026": {
    id: "gafi-2026",
    kind: "publication_autorite",
    title: "Seventh targeted update on virtual assets and VASPs",
    publisher: "GAFI",
    url: "https://www.fatf-gafi.org/en/publications/Fatfrecommendations/targeted-updated-virtualassets-vasps-2026.html",
    published: "2026-07-16",
    consultedOn: CONSULTED,
    supports:
      "État de la mise en œuvre des standards, supervision, usages illicites observés et coopération.",
  },
  "cmf-r561-1": {
    id: "cmf-r561-1",
    kind: "texte_officiel",
    title: "Code monétaire et financier, article R. 561-1",
    publisher: "Légifrance",
    url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036824564",
    consultedOn: CONSULTED,
    supports:
      "Définition française du bénéficiaire effectif d'une société : plus de 25 % du capital ou des droits de vote, ou contrôle par un autre moyen.",
  },
  "amlr-2024-1624": {
    id: "amlr-2024-1624",
    kind: "texte_officiel",
    title: "Règlement (UE) 2024/1624 (AMLR)",
    publisher: "EUR-Lex",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32024R1624",
    published: "2024-06",
    consultedOn: CONSULTED,
    supports:
      "Seuil de 25 % ou plus et contrôle par d'autres moyens ; application principale au 10 juillet 2027.",
    limits: "Extraits officiels consultés ; lecture intégrale via ce canal non obtenue.",
  },
  "ccom-l233-3": {
    id: "ccom-l233-3",
    kind: "texte_officiel",
    title: "Code de commerce, article L. 233-3",
    publisher: "Légifrance",
    url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031564650",
    consultedOn: CONSULTED,
    supports:
      "Modalités du contrôle, dont la présomption au-delà de 40 % des droits de vote sans détenteur supérieur.",
  },
  "ccom-secret-affaires": {
    id: "ccom-secret-affaires",
    kind: "texte_officiel",
    title: "Code de commerce, articles L. 151-1 et suivants (secret des affaires)",
    publisher: "Légifrance",
    url: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000005634379/LEGISCTA000037266547/",
    consultedOn: CONSULTED,
    supports:
      "Critères du secret des affaires, obtention licite, atteintes et exceptions.",
  },
  "tresor-ief": {
    id: "tresor-ief",
    kind: "publication_autorite",
    title: "Investissements étrangers en France",
    publisher: "DG Trésor",
    url: "https://www.tresor.economie.gouv.fr/services-aux-entreprises/investissements-etrangers-en-france",
    consultedOn: CONSULTED,
    supports: "Périmètre et procédure du contrôle des investissements étrangers (IEF).",
  },
  "cmf-r151-2": {
    id: "cmf-r151-2",
    kind: "texte_officiel",
    title: "Code monétaire et financier, article R. 151-2",
    publisher: "Légifrance",
    url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054604038",
    published: "2026-08",
    consultedOn: CONSULTED,
    supports: "Opérations d'investissement soumises au contrôle IEF et leurs exceptions.",
    limits: "Version consultée après la modification d'août 2026, à apprécier dans son contexte.",
  },
  "dgsi-flash-ingerence": {
    id: "dgsi-flash-ingerence",
    kind: "publication_autorite",
    title: "Conseils aux entreprises et Flash ingérence",
    publisher: "DGSI",
    url: "https://www.dgsi.interieur.gouv.fr/dgsi-a-vos-cotes/contre-espionnage/conseils-aux-entreprises-flash-ingerence",
    consultedOn: CONSULTED,
    supports: "Illustrations et préconisations préventives contre l'ingérence économique.",
    limits: "Cas illustratifs, sans valeur de fréquence pour toutes les entreprises ou nationalités.",
  },
  "anssi-hygiene": {
    id: "anssi-hygiene",
    kind: "guide",
    title: "Guide d'hygiène informatique",
    publisher: "ANSSI",
    url: "https://messervices.cyber.gouv.fr/guides/guide-dhygiene-informatique",
    published: "2017",
    consultedOn: CONSULTED,
    supports: "Mesures de protection : gestion des accès, moindre privilège, journalisation.",
  },
  "gleif-level2": {
    id: "gleif-level2",
    kind: "documentation_technique",
    title: "Level 2 data : Who Owns Whom",
    publisher: "GLEIF",
    url: "https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-who-owns-whom/roc-policy-on-level-2-data",
    consultedOn: CONSULTED,
    supports: "Parents de consolidation comptable déclarés.",
    limits: "Ni registre exhaustif de l'actionnariat, ni liste de bénéficiaires effectifs.",
  },
  "tracfin-2025": {
    id: "tracfin-2025",
    kind: "publication_autorite",
    title: "Rapport d'activité et d'impact 2025",
    publisher: "Tracfin",
    url: "https://www.economie.gouv.fr/tracfin/tracfin-publie-son-rapport-dactivite-et-dimpact-2025",
    published: "2026-09-07",
    consultedOn: CONSULTED,
    supports: "Contexte institutionnel et tendances publiées par la cellule de renseignement financier.",
    limits: "Aucun accès aux dossiers de Tracfin n'est supposé.",
  },
  "mica-2023-1114": {
    id: "mica-2023-1114",
    kind: "texte_officiel",
    title: "Règlement (UE) 2023/1114 (MiCA)",
    publisher: "EUR-Lex",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32023R1114",
    published: "2023-05",
    consultedOn: CONSULTED,
    supports:
      "Catégories de cryptoactifs (jetons de monnaie électronique, jetons se référant à des actifs, autres) et prestataires de services.",
    limits: "Extraits officiels repérés ; exclusions à relire dans la version complète.",
  },
} satisfies Record<string, SourceRecord>;

export type LearningSourceId = keyof typeof LEARNING_SOURCES;

export function getSource(id: string): SourceRecord | undefined {
  return (LEARNING_SOURCES as Record<string, SourceRecord>)[id];
}
