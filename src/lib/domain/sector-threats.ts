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
      "Structures interposees ou holdings en cascade",
      "Exposition sanctions directe ou par proximite de graphe",
      "Comptes de passage et contreparties recemment constituees",
    ],
    kybSignals: [
      "UBO recalcule divergent du declaratif",
      "Chemins courts vers une entite visee par une liste sanctions",
      "Societe recente tres connectee a des dirigeants ou adresses pivots",
    ],
    requiredEvidence: [
      "RNE/INPI pour mandataires et beneficiaires declares",
      "Sirene pour etat administratif, NAF et etablissement",
      "Listes officielles gels et sanctions documentees",
    ],
    limitations: [
      "Un chemin de proximite n'etablit pas une relation juridique",
      "Les homonymies sanctions exigent une revue humaine avant decision",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "immobilier",
    sector: "Immobilier et gestion d'actifs",
    exposure:
      "Actifs a forte valeur, intermediaires multiples, SCI, holdings patrimoniales et mouvements rapides de controle.",
    threats2026: [
      "Beneficiaire effectif masque par empilement de societes",
      "Changements de mandataires proches d'une operation sensible",
      "Adresses partagees avec un reseau d'entites peu documentees",
    ],
    kybSignals: [
      "Boucles de detention ou capital indirect concentre",
      "Radiation, procedure ou changement recent dans la timeline",
      "Adresse pivot utilisee par plusieurs societes liees",
    ],
    requiredEvidence: [
      "RNE/INPI et annonces legales disponibles",
      "Sirene pour etat et adresse du siege",
      "Historique des liens de detention avec dates de validite",
    ],
    limitations: [
      "La valeur de l'actif n'est pas prouvee par le graphe KYB",
      "Les donnees personnelles nominatives restent derriere auth et interet legitime",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "experts-comptables-audit",
    sector: "Experts-comptables, audit et conseil",
    exposure:
      "Obligation de vigilance client, justification des diligences et revue documentee des signaux inhabituels.",
    threats2026: [
      "Client avec controle indirect difficile a expliquer",
      "Mandataires multi-societes sur un reseau dense",
      "Sources incompletes ou declarations contradictoires",
    ],
    kybSignals: [
      "Score de qualite de preuve partiel ou manquant",
      "Ecart entre UBO declare et UBO recalcule",
      "Centralite forte d'une personne ou adresse dans plusieurs dossiers",
    ],
    requiredEvidence: [
      "Source record horodate et hash du payload",
      "Pieces RNE/INPI, Sirene et BODACC citees dans le dossier",
      "Export JSON/PDF avec statut computed, partial ou missing",
    ],
    limitations: [
      "KYB Graph documente des signaux, pas une conclusion disciplinaire",
      "Une source fixture doit rester visible comme demonstration",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "achats-fournisseurs",
    sector: "Achats fournisseurs et third-party risk",
    exposure:
      "Dependance fournisseurs, sous-traitance, ransomware, risques cyber et continuite d'activite.",
    threats2026: [
      "Fournisseur critique relie a une procedure ou radiation recente",
      "Sous-traitant avec gouvernance opaque ou adresse pivot",
      "Risque cyber supply-chain touchant un partenaire cle",
    ],
    kybSignals: [
      "Timeline juridique defavorable sur une contrepartie",
      "Mandataire dirigeant plusieurs societes du meme reseau",
      "Proximite sanctions ou source live degradee",
    ],
    requiredEvidence: [
      "BODACC pour evenements juridiques",
      "Sirene pour etat actif et etablissement",
      "Source cyber ou questionnaire interne rattache comme evidence manual",
    ],
    limitations: [
      "Le graphe juridique ne remplace pas une evaluation cyber technique",
      "Les donnees de sous-traitance privees exigent une source interne autorisee",
    ],
    officialSources: [ENISA, AMLR, TRACFIN],
  },
  {
    slug: "secteur-public",
    sector: "Secteur public et commande publique",
    exposure:
      "Besoin de justifier la selection de contreparties, le suivi sanctions et la prevention des conflits d'interets.",
    threats2026: [
      "Beneficiaire ou dirigeant indirect difficile a etablir",
      "Exposition a sanctions par entite reliee",
      "Reseau de societes partageant dirigeants ou adresses",
    ],
    kybSignals: [
      "Chemin vers liste officielle gels ou OpenSanctions",
      "Adresse partagee par plusieurs candidats ou fournisseurs",
      "SourceHealth mixed ou failed sur dossier critique",
    ],
    requiredEvidence: [
      "Journal des sources officielles consultees",
      "Export PDF avec limites juridiques",
      "Trace d'interet legitime avant exposition UBO nominative",
    ],
    limitations: [
      "Une proximite de graphe doit etre qualifiee par un agent habilite",
      "Les decisions d'achat requierent les regles internes et le contradictoire",
    ],
    officialSources: [AMLR, FATF_BO, TRACFIN],
  },
  {
    slug: "transport-logistique",
    sector: "Transport, logistique et commerce international",
    exposure:
      "Flux transfrontieres, intermediaires nombreux, sanctions, biens sensibles et dependances operationnelles.",
    threats2026: [
      "Contournement de sanctions par chaines d'intermediaires",
      "Societes recentes avec activite changeante ou peu lisible",
      "Partenaires connectes a adresses ou dirigeants pivots",
    ],
    kybSignals: [
      "Proximite sanctions par chemin court",
      "NAF, siege ou evenement juridique incoherent avec l'operation",
      "Densite de liens entre fournisseurs, transitaires et clients",
    ],
    requiredEvidence: [
      "Sirene/RNE pour identite et mandataires",
      "Listes gels et sanctions avec statut d'homonymie",
      "BODACC pour changements ou procedures",
    ],
    limitations: [
      "KYB Graph n'atteste pas la nature exacte des marchandises",
      "Les listes sanctions requierent une revue des identifiants, pas seulement du nom",
    ],
    officialSources: [AMLR, FATF_TF, ENISA],
  },
  {
    slug: "sante-pharma",
    sector: "Sante, pharma et medtech",
    exposure:
      "Fournisseurs critiques, distributeurs, donnees sensibles, continuites de soins et risques cyber eleves.",
    threats2026: [
      "Ransomware ou compromission supply-chain chez un partenaire",
      "Distributeur ou prestataire avec controle indirect opaque",
      "Changement juridique proche d'un contrat critique",
    ],
    kybSignals: [
      "SourceHealth failed sur une source critique",
      "Mandataires ou holdings interposees dans la chaine de controle",
      "Evenement BODACC recent a revoir avant onboarding",
    ],
    requiredEvidence: [
      "Sirene, RNE/INPI et BODACC",
      "Documentation interne tier risk rattachee en source manual",
      "Export avec statut live, mixed ou fixture visible",
    ],
    limitations: [
      "Le risque cyber doit etre complete par preuves techniques",
      "Les donnees de sante ne doivent jamais etre injectees dans le graphe KYB public",
    ],
    officialSources: [ENISA, AMLR, TRACFIN],
  },
  {
    slug: "btp-commodities",
    sector: "BTP, energie et commodities",
    exposure:
      "Chantiers en cascade, sous-traitance, matieres premieres, paiements internationaux et intermediaires locaux.",
    threats2026: [
      "Sous-traitance en chaine avec UBO peu lisible",
      "Exposition indirecte sanctions ou zone sensible",
      "Societe recente fortement reliee a un reseau existant",
    ],
    kybSignals: [
      "Capital indirect concentre et liens inferes a confirmer",
      "Adresse pivot entre plusieurs fournisseurs",
      "Procedure collective ou radiation dans la timeline",
    ],
    requiredEvidence: [
      "Sirene/RNE pour identite, mandataires et etat",
      "BODACC pour evenements juridiques",
      "Listes officielles sanctions et gels",
    ],
    limitations: [
      "Le graphe ne prouve pas la livraison ni la qualite contractuelle",
      "Les liens inferes restent des hypotheses documentees",
    ],
    officialSources: [AMLR, FATF_BO, FATF_TF, TRACFIN],
  },
];

export const FEATURED_SECTOR_PROFILES = SECTOR_THREAT_PROFILES.slice(0, 4);
