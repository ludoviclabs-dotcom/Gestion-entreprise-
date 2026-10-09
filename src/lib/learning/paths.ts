import type { LearningPath } from "./schema";

/**
 * Les deux parcours guidés du Lab (cadrage §4 à §7).
 *
 * Contenu éditorial versionné : aucune génération automatique. Les notions
 * citent des sources réelles (voir `sources.ts`) ; une notion sans source est
 * une définition pédagogique propre au Lab, signalée comme telle à l'écran.
 */

export const CONTROLE_ACTIFS: LearningPath = {
  id: "controle-actifs",
  slug: "controle-actifs",
  title: "Contrôle et actifs stratégiques",
  question: "Qui contrôle quoi, et quelle dépendance évolue ?",
  intro:
    "Une jeune entreprise industrielle lève des fonds, signe une licence et ouvre ses systèmes à un prestataire. Vous apprenez à lire capital, droits de vote, dépendances et accès, sans transformer une relation en menace.",
  audience: [
    "Équipes conformité, LCB-FT et KYB",
    "Analystes et auditeurs",
    "Dirigeants, juristes, responsables R&D et sécurité",
    "Étudiants et nouveaux collaborateurs",
  ],
  objectives: [
    "Distinguer détention économique, droits de contrôle et qualification de bénéficiaire effectif.",
    "Comparer l'actionnariat à plusieurs dates et dire ce qui change vraiment.",
    "Mesurer une dépendance commerciale avec son périmètre, sans lui prêter une intention.",
    "Séparer propriété, licence et accès pour chaque actif important.",
    "Formuler plusieurs hypothèses, choisir les pièces utiles et accepter une conclusion indécidable.",
  ],
  durationMinutes: 35,
  scenarioTitle: "Aster Photonique",
  scenarioSummary:
    "Aster Photonique développe un capteur industriel. Elle détient un brevet et un logiciel, contrôle un jeu de données et utilise un procédé confidentiel. Helix entre au capital, Orion finance une partie de l'activité, Meridian devient un client majeur et VectorLab intervient sur une prestation technique. Tous les noms, pièces et montants sont fictifs.",
  outline: [
    {
      title: "T0 : la situation de départ",
      detail: "Fondatrice à 70 %, investisseurs initiaux à 30 %. Décrire les actifs importants et les relations.",
    },
    {
      title: "T1 : la levée de fonds",
      detail: "Helix détient 45 % et devient premier actionnaire. Faut-il attendre 50 % pour parler de contrôle ?",
    },
    {
      title: "T2 : la conversion",
      detail: "Helix passe à 55 % des votes. Un changement de contrôle documenté n'établit pas une intention abusive.",
    },
    {
      title: "T3 : la dépendance client",
      detail: "Meridian représente 58 % du chiffre d'affaires et bénéficie d'une licence limitée.",
    },
    {
      title: "T4 : l'habilitation à vérifier",
      detail: "L'accès de VectorLab reste actif après la date de fin initiale ; l'avenant manque au dossier.",
    },
    {
      title: "Hypothèses, pièces et débriefing",
      detail: "Deux branches selon les pièces révélées, et ce qui reste ouvert dans chacune.",
    },
  ],
  views: [
    { title: "Propriété et gouvernance", question: "Qui contrôle cette entreprise à cette date ?" },
    { title: "Dépendances", question: "De quel acteur dépend-elle, et dans quel périmètre ?" },
    { title: "Actifs stratégiques", question: "Qui dispose de quels droits sur chaque actif ?" },
    { title: "Chronologie comparée", question: "Qu'est-ce qui a changé entre T0 et T4 ?" },
  ],
  notions: [
    {
      id: "beneficiaire-effectif",
      term: "Bénéficiaire effectif",
      definition:
        "Personne physique qui détient, directement ou indirectement, plus de 25 % du capital ou des droits de vote d'une société, ou qui la contrôle par un autre moyen. Sous l'AMLR, le seuil devient « 25 % ou plus ».",
      caution:
        "Exactement 25 % ne suffit pas en droit français actuel. Une chaîne incomplète ne signifie ni absence de bénéficiaire ni fraude.",
      sourceIds: ["cmf-r561-1", "amlr-2024-1624"],
    },
    {
      id: "controle",
      term: "Contrôle",
      definition:
        "Pouvoir de décider dans les assemblées ou les organes d'une société : majorité des droits de vote, accord avec d'autres associés, droit de nommer la majorité des dirigeants. Au-delà de 40 % des votes sans détenteur supérieur, le contrôle est présumé.",
      caution: "50 % n'est pas une majorité. Moins de 50 % ne prouve pas l'absence de contrôle.",
      sourceIds: ["ccom-l233-3"],
    },
    {
      id: "detention-economique",
      term: "Détention économique",
      definition:
        "Part du capital obtenue en multipliant les participations le long d'une chaîne et en additionnant les chemins parallèles. Elle se calcule ; le contrôle, lui, se documente.",
      caution: "Capital et droits de vote peuvent différer : actions de préférence, droits de vote double, pacte.",
      sourceIds: [],
    },
    {
      id: "ief",
      term: "Contrôle des investissements étrangers (IEF)",
      definition:
        "Autorisation préalable exigée pour certains investissements étrangers dans des activités sensibles. La nature de l'investisseur, l'opération et l'activité s'examinent ensemble.",
      caution: "Une autorisation IEF, ou son exigence, ne qualifie pas une intention hostile.",
      sourceIds: ["tresor-ief", "cmf-r151-2"],
    },
    {
      id: "secret-affaires",
      term: "Secret des affaires",
      definition:
        "Information non généralement accessible, ayant une valeur commerciale du fait de son caractère secret et protégée par des mesures raisonnables.",
      caution: "Une étiquette « confidentiel » ne suffit pas. Une création indépendante reste licite.",
      sourceIds: ["ccom-secret-affaires"],
    },
    {
      id: "actif-strategique",
      term: "Actif stratégique",
      definition:
        "Qualificatif propre au parcours : un actif dont l'entreprise dépend pour son activité, difficile à remplacer et sensible. On distingue titulaire, détenteur, exploitant sous licence et personne ayant accès.",
      caution: "Ce n'est pas une catégorie juridique du contrôle IEF.",
      sourceIds: [],
    },
    {
      id: "ingerence",
      term: "Ingérence économique",
      definition:
        "Action visant à influencer ou capter des décisions, des informations ou des actifs par des moyens déloyaux ou illicites. Elle se distingue de la concurrence et de l'intelligence économique licites par ses moyens et sa finalité.",
      caution: "La nationalité d'un investisseur ou une simple proximité dans le graphe ne la démontre pas.",
      sourceIds: ["dgsi-flash-ingerence"],
    },
    {
      id: "hygiene-acces",
      term: "Gestion des accès",
      definition:
        "Attribuer, revoir et retirer les habilitations selon le besoin, avec moindre privilège et journalisation. Une habilitation active après une fin de mission est un point à vérifier.",
      caution: "Un accès maintenu peut être prévu par un avenant : il manque une pièce, pas une preuve.",
      sourceIds: ["anssi-hygiene"],
    },
  ],
  status: "disponible",
};

export const CRYPTO_FLUX: LearningPath = {
  id: "crypto-flux",
  slug: "crypto-flux",
  title: "Cryptoactifs et circulation des fonds",
  question: "Comment circule la valeur, et que peut-on vérifier à chaque étape ?",
  intro:
    "Une entreprise règle une prestation internationale en passant par un jeton stable. Vous suivez le paiement de la banque au prestataire, puis sur la chaîne, et vous repérez où l'information devient incertaine.",
  audience: [
    "Équipes conformité, LCB-FT et KYB",
    "Analystes et auditeurs",
    "Étudiants et nouveaux collaborateurs",
  ],
  objectives: [
    "Séparer argent bancaire, actif numérique et écritures internes d'un prestataire.",
    "Lire une opération en unités exactes, avec ses frais et ses jambes.",
    "Désigner les frontières de connaissance : ce qu'une adresse ne dit pas d'une personne.",
    "Comparer ce que voient la banque, le prestataire, l'analyste et l'autorité.",
    "Formuler une explication licite à côté de l'hypothèse de fraude, puis choisir les vérifications.",
  ],
  durationMinutes: 35,
  scenarioTitle: "Le paiement de Nova",
  scenarioSummary:
    "Nova, entreprise française, règle une prestation internationale. Elle achète un jeton stable fictif, S-EUR, auprès du prestataire fictif PorteX, l'envoie vers un compte externe, puis ne dispose que de documents partiels sur la conversion et le bénéficiaire final. Aucune adresse ni aucun identifiant réel.",
  outline: [
    { title: "Situation initiale", detail: "Facture et contrat : qui paie, pour quoi, et à qui ?" },
    { title: "Parcours", detail: "Banque, prestataire, chaîne : où passe-t-on de l'euro au jeton ?" },
    { title: "Signal", detail: "Le bénéficiaire déclaré diffère de l'instruction de paiement." },
    { title: "Hypothèses", detail: "Mandataire autorisé, erreur documentaire ou fraude au changement de coordonnées." },
    { title: "Vérifications", detail: "Confirmation indépendante, mandat, attribution du compte, justificatif de conversion." },
    { title: "Branche et débriefing", detail: "Mandat valide ou substitution non autorisée ; la sortie bancaire peut rester inconnue." },
  ],
  views: [
    { title: "Graphe à couches", question: "Qui intervient, et quelle relation est documentée ?" },
    { title: "Parcours animé", question: "Qu'observe-t-on à chaque étape du paiement ?" },
    { title: "Chronologie", question: "Dans quel ordre arrivent opérations et documents ?" },
    { title: "Perspectives", question: "Que voit chaque observateur, et que ne voit-il pas ?" },
  ],
  notions: [
    {
      id: "cryptoactif-mica",
      term: "Cryptoactif et MiCA",
      definition:
        "Représentation numérique d'une valeur ou d'un droit, transférable et stockable sur un registre distribué. MiCA distingue les jetons de monnaie électronique, les jetons se référant à des actifs et les autres cryptoactifs.",
      caution: "Une appellation commerciale ne fixe pas la qualification juridique.",
      sourceIds: ["mica-2023-1114", "amf-mica"],
    },
    {
      id: "jeton-stable",
      term: "Jeton « stable »",
      definition:
        "Jeton qui vise une valeur stable par référence à une monnaie officielle ou à d'autres actifs. Sous MiCA, il relève selon le cas des jetons de monnaie électronique ou des jetons se référant à des actifs.",
      caution: "Le mot « stablecoin » ne garantit ni la stabilité ni la conformité.",
      sourceIds: ["mica-2023-1114"],
    },
    {
      id: "instrument-financier",
      term: "Cryptoactif qualifié d'instrument financier",
      definition:
        "Certains jetons représentent des droits comparables à des titres ou des créances ; ils relèvent alors du droit des instruments financiers plutôt que de MiCA.",
      caution: "« RWA » ou « NFT » ne sont pas des catégories juridiques suffisantes.",
      sourceIds: ["esma-qualification"],
    },
    {
      id: "prestataire",
      term: "Prestataire de services sur cryptoactifs",
      definition:
        "Entreprise qui conserve, échange ou transfère des cryptoactifs pour ses clients. Depuis le 1er juillet 2026 en France, un ancien enregistrement PSAN ne vaut plus autorisation.",
      caution: "Vérifier le statut du service exact, à la date de l'opération, dans le registre.",
      sourceIds: ["amf-transition-mica", "esma-mica-registres"],
      appliesFrom: "2026-07-01",
    },
    {
      id: "adresse-identite",
      term: "Adresse et identité",
      definition:
        "Une adresse est un identifiant sur un réseau donné. Le logiciel de portefeuille n'est pas l'identité du détenteur, et une adresse ne situe pas une personne.",
      caution: "Un regroupement d'adresses est une inférence, avec un risque d'erreur.",
      sourceIds: ["ethereum-accounts", "bitcoin-transactions"],
    },
    {
      id: "utxo-compte",
      term: "Modèle UTXO et modèle compte",
      definition:
        "Bitcoin consomme des entrées et crée des sorties ; Ethereum débite et crédite des comptes. Une transaction peut avoir plusieurs jambes, frais compris.",
      caution: "On n'additionne jamais deux unités différentes pour « équilibrer » un flux.",
      sourceIds: ["bitcoin-transactions", "ethereum-accounts"],
    },
    {
      id: "travel-rule",
      term: "Règle de voyage (Travel Rule)",
      definition:
        "Les transferts de cryptoactifs dans le champ du règlement 2023/1113 doivent être accompagnés d'informations sur le donneur d'ordre et le bénéficiaire.",
      caution: "Les dispositions sur les adresses auto-hébergées ne créent pas d'exemption générale.",
      sourceIds: ["eba-travel-rule"],
      appliesFrom: "2024-12-30",
    },
    {
      id: "indicateurs-gafi",
      term: "Indicateurs de risque",
      definition:
        "Le GAFI publie des indicateurs qui orientent une vérification : rupture d'attribution, circulation complexe sans justification, prestataire au statut non confirmé.",
      caution: "Un indicateur isolé ne démontre ni blanchiment ni financement du terrorisme.",
      sourceIds: ["gafi-red-flags", "gafi-2026", "tracfin-2025"],
    },
    {
      id: "frontiere-connaissance",
      term: "Frontière de connaissance",
      definition:
        "Point du parcours où l'information disponible s'arrête : compte non attribué, écriture interne d'un prestataire, crédit bancaire sans pièce. L'animation s'y arrête.",
      caution: "Ce qui n'est pas documenté reste inconnu ; on ne le comble pas par déduction.",
      sourceIds: [],
    },
  ],
  status: "disponible",
};

export const LEARNING_PATHS: LearningPath[] = [CONTROLE_ACTIFS, CRYPTO_FLUX];

export function getLearningPath(slug: string): LearningPath | undefined {
  return LEARNING_PATHS.find((p) => p.slug === slug);
}
