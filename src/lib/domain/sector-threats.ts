export type OfficialSource = {
  label: string;
  url: string;
};

export type SectorThreatProfile = {
  slug: string;
  sector: string;
  exposure: string;
  threats2026: string[];
  kybSignals: string[];
  requiredEvidence: string[];
  limitations: string[];
  officialSources: OfficialSource[];
};

const AMLR = {
  label: "Reglement (UE) 2024/1624, AMLR",
  url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1624",
};

const FATF_BO = {
  label: "FATF, Beneficial ownership",
  url: "https://www.fatf-gafi.org/en/topics/beneficial-ownership.html",
};

const FATF_TF = {
  label: "FATF, Terrorist Financing Risks 2025",
  url: "https://www.fatf-gafi.org/content/dam/fatf-gafi/publications/Comprehensive-Update-on-Terrorist-Financing-Risks-2025.pdf.coredownload.inline.pdf",
};

const TRACFIN = {
  label: "Tracfin, rapports d'activite et d'analyse",
  url: "https://www.economie.gouv.fr/tracfin/les-publications-de-tracfin/les-rapports-dactivite-et-danalyse",
};

const WIRECARD = {
  label: "Wirecard, 1,9 Md EUR introuvables",
  url: "https://www.theguardian.com/business/2020/jun/22/german-payments-firm-wirecard-says-missing-19bn-may-not-exist",
};

const EU_RUSSIA_SANCTIONS_2025 = {
  label: "UE, sanctions flotte fantome 2025",
  url: "https://www.theguardian.com/world/2025/oct/23/latest-eu-sanctions-against-russia-target-liquified-natural-gas",
};

const GUNVOR = {
  label: "Gunvor, accord anticorruption 661 M USD",
  url: "https://apnews.com/article/3470a90b5c66e1e774509b4ad8f950d7",
};

const VERIZON_DBIR = {
  label: "Verizon DBIR 2026",
  url: "https://www.verizon.com/business/resources/reports/dbir/",
};

const CHANGE_HEALTHCARE = {
  label: "Change Healthcare, environ 190 M personnes",
  url: "https://www.tomsguide.com/computing/online-security/over-190-million-hit-in-unitedhealth-data-breach-confirmed-largest-in-history",
};

const ENISA = {
  label: "ENISA Threat Landscape 2025",
  url: "https://www.enisa.europa.eu/sites/default/files/2025-10/ENISA%20Threat%20Landscape%202025%20Booklet.pdf",
};

export const SECTOR_THREAT_PROFILES: SectorThreatProfile[] = [
  {
    slug: "banque-finance",
    sector: "Banque, paiement et finance",
    exposure:
      "Obligations risk-based, surveillance des beneficiaires effectifs, sanctions et chaines de controle transfrontieres.",
    threats2026: [
      "2026 : virements instantanes, mules KYC recrutees sur Telegram",
      "Wirecard 2020 : 1,9 Md EUR de cash introuvable",
      "AMLR 2024/1624 : holdings mixtes couverts des 2027",
    ],
    kybSignals: [
      "UBO declare contre UBO calcule : ecart >25 %",
      "IBAN pivot : trois societes, meme compte beneficiaire",
      "Sanctions : deux sauts vers entite UE/OFAC",
    ],
    requiredEvidence: [
      "RNE/INPI : mandataires, UBO, dates de controle",
      "Screening UE/OFAC/DG Tresor horodate, alias inclus",
      "Origine des fonds et motif economique signes",
    ],
    limitations: [
      "Le risque reel ici : homonyme de sanctions.",
      "Le graphe ne prouve pas le virement.",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN, WIRECARD],
  },
  {
    slug: "immobilier",
    sector: "Immobilier et gestion d'actifs",
    exposure:
      "Actifs a forte valeur, intermediaires multiples, SCI, holdings patrimoniales et mouvements rapides de controle.",
    threats2026: [
      "2025 : SCI familiales absorbent cash sans financement lisible",
      "AMLR 2027 : UBO requis pour societes non-UE",
      "AMLR 2027 : seuil EUR50 M pour patrimoine total",
    ],
    kybSignals: [
      "Acquisition via SCI sans dette bancaire coherente",
      "Apport compte courant proche du prix d'achat",
      "Beneficiaire non-UE absent du registre central",
    ],
    requiredEvidence: [
      "Acte notarie, prix, financement, origine des fonds",
      "RNE/INPI, registre UBO, Kbis SCI",
      "Evaluation actif et flux bancaires d'acquisition",
    ],
    limitations: [
      "Le graphe ne valorise pas l'immeuble.",
      "Un montage patrimonial peut rester licite.",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "experts-comptables-audit",
    sector: "Experts-comptables, audit et conseil",
    exposure:
      "Obligation de vigilance client, justification des diligences et revue documentee des signaux inhabituels.",
    threats2026: [
      "2025 : clients ecrans demandent domiciliation et facturation",
      "AMLR 2024/1624 couvre comptables, auditeurs, fiscalistes",
      "2026 : IA genere pieces KYC trop propres",
    ],
    kybSignals: [
      "Cabinet pivot sur reseaux de societes dormantes",
      "Client refuse UBO malgre seuil 25 %",
      "Pieces identiques sur dossiers sans lien economique",
    ],
    requiredEvidence: [
      "Lettre de mission, KYC, PEP, sanctions",
      "Source record horodate et hash du justificatif",
      "Trace revue associe et decision d'acceptation",
    ],
    limitations: [
      "Le signal ne vaut pas soupcon automatique.",
      "Le secret professionnel borne l'exploitation graphe.",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "achats-fournisseurs",
    sector: "Achats fournisseurs et third-party risk",
    exposure:
      "Dependance fournisseurs, sous-traitance, ransomware, risques cyber et continuite d'activite.",
    threats2026: [
      "2026 DBIR : ransomware dans 48 % des intrusions",
      "2026 : faille logiciel depasse mot de passe vole",
      "2025 : fournisseur SaaS devient point d'entree unique",
    ],
    kybSignals: [
      "Fournisseur critique lie a procedure BODACC 12 mois",
      "Dirigeant commun entre fournisseur et acheteur interne",
      "Domaine cree <30 jours, IBAN change hors contrat",
    ],
    requiredEvidence: [
      "BODACC, Sirene, contrat, avenants et RIB successifs",
      "Questionnaire cyber, assurance, preuves MFA et sauvegardes",
      "Cartographie des sous-traitants de rang 2",
    ],
    limitations: [
      "KYB ne remplace pas un pentest.",
      "Le rang 3 reste souvent hors contrat.",
    ],
    officialSources: [VERIZON_DBIR, ENISA, AMLR, TRACFIN],
  },
  {
    slug: "secteur-public",
    sector: "Secteur public et commande publique",
    exposure:
      "Besoin de justifier la selection de contreparties, le suivi sanctions et la prevention des conflits d'interets.",
    threats2026: [
      "2025 : acheteurs publics ciblent UBO avant notification",
      "AMLR 2027 : seuil UBO 25 % harmonise",
      "2026 : conflits d'interets via dirigeants familiaux",
    ],
    kybSignals: [
      "Deux candidats partagent adresse, dirigeant ou conseil",
      "Societe creee <90 jours avant appel d'offres",
      "UBO non-UE absent avant signature contractuelle",
    ],
    requiredEvidence: [
      "DCE, AE, DC2, sous-traitants et avenants",
      "RNE, registre UBO, declarations conflits d'interets",
      "Journal horodate des consultations sanctions",
    ],
    limitations: [
      "Le graphe n'annule pas une procedure.",
      "Le contradictoire reste une obligation.",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "transport-logistique",
    sector: "Transport, logistique et commerce international",
    exposure:
      "Flux transfrontieres, intermediaires nombreux, sanctions, biens sensibles et dependances operationnelles.",
    threats2026: [
      "2025 : 117 navires ajoutes au paquet UE 19",
      "2025 : faux pavillons et AIS coupe sur tankers",
      "2026 : transitaires ecrans entre chargeur, fret, assureur",
    ],
    kybSignals: [
      "IMO renomme, pavillon change, assureur hors P&I",
      "Adresse transitaire partagee par concurrents sans lien public",
      "Pays de chargement incompatible avec facture douaniere",
    ],
    requiredEvidence: [
      "Connaissement, AIS, certificat P&I, incoterm horodates",
      "Listes UE/UK/OFAC jointes avec date de consultation",
      "Beneficiaire payeur final rapproche du contrat freight-forwarder",
    ],
    limitations: [
      "AIS coupe ne suffit jamais seul.",
      "Le graphe ignore le contenu exact du conteneur.",
    ],
    officialSources: [EU_RUSSIA_SANCTIONS_2025, AMLR, FATF_TF, ENISA],
  },
  {
    slug: "sante-pharma",
    sector: "Sante, pharma et medtech",
    exposure:
      "Fournisseurs critiques, distributeurs, donnees sensibles, continuite des soins et ransomware documente.",
    threats2026: [
      "2025 : Change Healthcare atteint environ 190 M personnes",
      "2026 DBIR : ransomware dans 48 % des intrusions",
      "2026 : distributeurs medtech concentrent donnees et facturation",
    ],
    kybSignals: [
      "Prestataire IT commun entre hopital, grossiste, medtech",
      "Changement RIB fournisseur sans avenant signe",
      "UBO offshore derriere distributeur de dispositifs",
    ],
    requiredEvidence: [
      "Contrat HDS, DPA, PCA et attestation ISO",
      "RNE/INPI, autorisations ANSM, pharmacien responsable",
      "Logs changement RIB et validation double controle",
    ],
    limitations: [
      "Aucune donnee patient dans KYB public.",
      "Le risque cyber exige preuves techniques.",
    ],
    officialSources: [CHANGE_HEALTHCARE, VERIZON_DBIR, ENISA, AMLR, TRACFIN],
  },
  {
    slug: "btp-commodities",
    sector: "BTP, energie et commodities",
    exposure:
      "Chantiers en cascade, sous-traitance, matieres premieres, paiements internationaux et intermediaires locaux.",
    threats2026: [
      "2025 : sanctions energie russe contournent traders et tankers",
      "Gunvor 2024 : 661 M USD payes sur dossier Ecuador",
      "2026 : sous-traitance chantier empilee sur micro-societes",
    ],
    kybSignals: [
      "Meme gerant sur trois lots et deux rangs",
      "Marge fournisseur incoherente avec capital social",
      "Adresse pivot entre depot, trader et sous-traitant",
    ],
    requiredEvidence: [
      "Contrat, bon livraison, facture, reception rapproches",
      "RNE, BODACC, attestations sociales et fiscales",
      "Sanctions UE/OFAC plus preuve d'origine produit",
    ],
    limitations: [
      "Le graphe ne valide pas la livraison.",
      "Les prix spot exigent controle metier.",
    ],
    officialSources: [GUNVOR, EU_RUSSIA_SANCTIONS_2025, AMLR, FATF_BO, FATF_TF, TRACFIN],
  },
];

export const FEATURED_SECTOR_PROFILES = SECTOR_THREAT_PROFILES.slice(0, 4);
