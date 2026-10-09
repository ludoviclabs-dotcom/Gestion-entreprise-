import { Scenario } from "../schema";

/**
 * Démonstrateur « Aster Photonique » (cadrage §7).
 *
 * TOUS LES NOMS, PIÈCES ET MONTANTS SONT FICTIFS. Aucun identifiant réel.
 * Les pourcentages découlent d'opérations cohérentes : 100 000 actions à T0,
 * 81 818 actions émises au profit de Helix à T1, 40 404 actions issues de la
 * conversion à T2 (une action, une voix).
 */
const aster = {
  id: "aster-photonique",
  version: "1.0.0",
  title: "Aster Photonique",
  fiction: true,
  summary:
    "Aster Photonique développe un capteur industriel. Elle lève des fonds auprès de Helix, emprunte auprès d'Orion, concède une licence à Meridian et ouvre son espace documentaire à un prestataire, VectorLab.",
  subjectId: "aster",
  layout: {
    fondatrice: { x: 180, y: 90, label: "above" },
    "invest-init": { x: 500, y: 90, label: "above" },
    helix: { x: 820, y: 90, label: "above" },
    aster: { x: 500, y: 290 },
    orion: { x: 860, y: 310, label: "above" },
    procede: { x: 180, y: 300 },
    vectorlab: { x: 90, y: 450, label: "above" },
    "espace-rd": { x: 240, y: 555 },
    donnees: { x: 375, y: 545 },
    logiciel: { x: 510, y: 560 },
    brevet: { x: 655, y: 545 },
    meridian: { x: 870, y: 530 },
  },
  actors: [
    { id: "aster", kind: "entreprise", name: "Aster Photonique", roles: ["Entreprise étudiée"], country: "France", origin: "fictive" },
    { id: "fondatrice", kind: "personne", name: "Claire Vidal", roles: ["Fondatrice", "Présidente"], country: "France", origin: "fictive" },
    { id: "invest-init", kind: "investisseur", name: "Investisseurs initiaux", roles: ["Business angels"], country: "France", origin: "fictive" },
    { id: "helix", kind: "investisseur", name: "Helix Capital", roles: ["Fonds d'investissement"], country: "Hors Union européenne", origin: "fictive" },
    { id: "orion", kind: "preteur", name: "Orion Finance", roles: ["Prêteur"], country: "France", origin: "fictive" },
    { id: "meridian", kind: "client", name: "Meridian Industries", roles: ["Client", "Licencié"], country: "Allemagne", origin: "fictive" },
    { id: "vectorlab", kind: "prestataire_technique", name: "VectorLab", roles: ["Prestataire d'intégration optique"], country: "France", origin: "fictive" },
  ],
  resources: [
    { id: "brevet", kind: "brevet", label: "Brevet du capteur à cavité", identifier: "EP-0000000-FICTIF", origin: "fictive" },
    { id: "logiciel", kind: "logiciel", label: "Logiciel de calibration AsterCal", origin: "fictive" },
    { id: "donnees", kind: "donnees", label: "Jeu de données d'étalonnage", origin: "fictive" },
    { id: "procede", kind: "procede", label: "Procédé de dépôt de couches", origin: "fictive" },
    { id: "espace-rd", kind: "systeme", label: "Espace documentaire R&D", origin: "fictive" },
  ],
  relations: [
    // ── Titularité des actifs ──
    { id: "tit-brevet", kind: "titularite", source: "aster", target: "brevet", label: "titulaire", validFrom: "2024-05-02", claimIds: ["c-inventaire"] },
    { id: "tit-logiciel", kind: "titularite", source: "aster", target: "logiciel", label: "titulaire", validFrom: "2023-03-01", claimIds: ["c-inventaire"] },
    { id: "tit-donnees", kind: "titularite", source: "aster", target: "donnees", label: "titulaire", validFrom: "2023-03-01", claimIds: ["c-inventaire"] },
    { id: "tit-procede", kind: "titularite", source: "aster", target: "procede", label: "titulaire", rights: "Savoir-faire confidentiel, accès nominatif", validFrom: "2023-03-01", claimIds: ["c-inventaire"] },
    { id: "tit-espace", kind: "titularite", source: "aster", target: "espace-rd", label: "exploite", validFrom: "2023-03-01", claimIds: ["c-inventaire"] },
    // ── Gouvernance et capital ──
    { id: "dir-fondatrice", kind: "direction", source: "fondatrice", target: "aster", label: "présidente", validFrom: "2023-03-01", claimIds: ["c-statuts"] },
    { id: "own-fond-t0", kind: "detention", source: "fondatrice", target: "aster", capitalPct: "70", votingPct: "70", validFrom: "2023-03-01", validTo: "2025-06-29", claimIds: ["c-statuts"] },
    { id: "own-init-t0", kind: "detention", source: "invest-init", target: "aster", capitalPct: "30", votingPct: "30", validFrom: "2023-03-01", validTo: "2025-06-29", claimIds: ["c-statuts"] },
    { id: "own-helix-t1", kind: "detention", source: "helix", target: "aster", capitalPct: "45", votingPct: "45", validFrom: "2025-06-30", validTo: "2026-01-14", claimIds: ["c-augmentation"] },
    { id: "own-fond-t1", kind: "detention", source: "fondatrice", target: "aster", capitalPct: "38.5", votingPct: "38.5", validFrom: "2025-06-30", validTo: "2026-01-14", claimIds: ["c-augmentation"] },
    { id: "own-init-t1", kind: "detention", source: "invest-init", target: "aster", capitalPct: "16.5", votingPct: "16.5", validFrom: "2025-06-30", validTo: "2026-01-14", claimIds: ["c-augmentation"] },
    { id: "own-helix-t2", kind: "detention", source: "helix", target: "aster", capitalPct: "55", votingPct: "55", validFrom: "2026-01-15", claimIds: ["c-conversion"] },
    { id: "own-fond-t2", kind: "detention", source: "fondatrice", target: "aster", capitalPct: "31.5", votingPct: "31.5", validFrom: "2026-01-15", claimIds: ["c-conversion"] },
    { id: "own-init-t2", kind: "detention", source: "invest-init", target: "aster", capitalPct: "13.5", votingPct: "13.5", validFrom: "2026-01-15", claimIds: ["c-conversion"] },
    {
      id: "ctl-pacte",
      kind: "controle",
      source: "helix",
      target: "aster",
      label: "pacte d'associés",
      rights: "Désigne 2 des 5 membres du conseil ; accord préalable pour céder le brevet ou concéder une licence exclusive",
      validFrom: "2025-06-30",
      claimIds: ["c-pacte"],
    },
    // ── Financement et dépendances ──
    { id: "fin-orion", kind: "financement", source: "orion", target: "aster", label: "prêt de 2 M€", rights: "Prêt de 2 000 000 € sur 5 ans", validFrom: "2025-09-01", claimIds: ["c-pret"] },
    { id: "sur-orion", kind: "surete", source: "orion", target: "brevet", label: "nantissement", rights: "Nantissement du brevet en garantie du prêt", validFrom: "2025-09-01", claimIds: ["c-pret"] },
    {
      id: "dep-meridian",
      kind: "dependance",
      source: "aster",
      target: "meridian",
      label: "58 % du CA",
      measure: {
        numerator: { value: "3600000", unit: "EUR" },
        denominator: { value: "6200000", unit: "EUR" },
        period: "Exercice 2025",
        scope: "Chiffre d'affaires facturé (comptes fictifs)",
      },
      validFrom: "2026-03-31",
      claimIds: ["c-ca"],
    },
    {
      id: "lic-meridian",
      kind: "licence",
      source: "brevet",
      target: "meridian",
      label: "licence limitée",
      rights: "Licence non exclusive, applications automobiles, Europe, 5 ans ; aucune cession de propriété",
      validFrom: "2026-02-01",
      claimIds: ["c-licence"],
    },
    { id: "pre-vectorlab", kind: "prestation", source: "vectorlab", target: "aster", label: "intégration optique", validFrom: "2025-10-01", validTo: "2026-04-30", claimIds: ["c-bdc"] },
    {
      id: "acc-vectorlab",
      kind: "acces",
      source: "vectorlab",
      target: "espace-rd",
      label: "habilitation",
      rights: "Dossier « Intégration » uniquement",
      validFrom: "2025-10-01",
      claimIds: ["c-bdc", "c-habilitation"],
    },
    // ── Relations propres aux branches ──
    {
      id: "pre-vectorlab-avenant",
      kind: "prestation",
      source: "vectorlab",
      target: "aster",
      label: "mission prolongée",
      rights: "Avenant n° 1 : prolongation jusqu'au 31/08/2026, accès limité au dossier « Intégration »",
      validFrom: "2026-05-01",
      validTo: "2026-08-31",
      branchId: "branche-a",
      claimIds: ["c-avenant"],
    },
    {
      id: "acc-procede",
      kind: "acces",
      source: "vectorlab",
      target: "procede",
      label: "ouverture non autorisée",
      rights: "Ouverture et téléchargement de « Procédé de dépôt – v7 » le 12/06/2026, hors périmètre et après la fin de mission",
      validFrom: "2026-06-12",
      branchId: "branche-b",
      claimIds: ["c-acces-procede"],
    },
  ],
  evidence: [
    {
      id: "p-statuts",
      title: "Statuts et registre des mouvements de titres",
      origin: "fictive",
      date: "2023-03-01",
      excerpt:
        "Capital de 100 000 € divisé en 100 000 actions. Claire Vidal : 70 000 actions ; investisseurs initiaux : 30 000 actions. Chaque action donne droit à une voix. Claire Vidal est nommée présidente.",
    },
    {
      id: "p-inventaire",
      title: "Inventaire des actifs incorporels",
      origin: "fictive",
      date: "2025-01-10",
      excerpt:
        "Brevet EP-0000000-FICTIF déposé le 02/05/2024, titulaire Aster Photonique. Logiciel AsterCal développé en interne. Jeu de données d'étalonnage constitué par Aster. Procédé de dépôt de couches : savoir-faire confidentiel, documentation en accès nominatif dans l'espace documentaire R&D.",
    },
    {
      id: "p-augmentation",
      title: "Procès-verbal d'augmentation de capital",
      origin: "fictive",
      date: "2025-06-30",
      excerpt:
        "Émission de 81 818 actions nouvelles souscrites par Helix Capital. Après l'opération : Helix 45 %, Claire Vidal 38,5 %, investisseurs initiaux 16,5 %. Droits de vote proportionnels au capital.",
    },
    {
      id: "p-pacte",
      title: "Pacte d'associés, articles 4 et 7",
      origin: "fictive",
      date: "2025-06-30",
      excerpt:
        "Art. 4 : Helix Capital désigne 2 des 5 membres du conseil d'administration. Art. 7 : toute cession du brevet ou toute licence exclusive requiert l'accord préalable de Helix Capital.",
    },
    {
      id: "p-pret",
      title: "Contrat de prêt Orion Finance",
      origin: "fictive",
      date: "2025-09-01",
      excerpt:
        "Prêt de 2 000 000 € sur 5 ans. Garantie : nantissement du brevet EP-0000000-FICTIF au profit d'Orion Finance.",
    },
    {
      id: "p-bdc",
      title: "Bon de commande VectorLab",
      origin: "fictive",
      date: "2025-09-20",
      excerpt:
        "Prestation d'intégration optique du 01/10/2025 au 30/04/2026. Accès à l'espace documentaire R&D limité au dossier « Intégration ».",
    },
    {
      id: "p-conversion",
      title: "Procès-verbal de conversion des obligations",
      origin: "fictive",
      date: "2026-01-15",
      excerpt:
        "Conversion de 40 404 obligations convertibles détenues par Helix Capital en autant d'actions. Après conversion : Helix 55 %, Claire Vidal 31,5 %, investisseurs initiaux 13,5 %.",
    },
    {
      id: "p-licence",
      title: "Contrat de licence Meridian Industries",
      origin: "fictive",
      date: "2026-02-01",
      excerpt:
        "Licence non exclusive du brevet EP-0000000-FICTIF, limitée aux applications automobiles en Europe, pour 5 ans. Aster Photonique reste seule titulaire du brevet.",
    },
    {
      id: "p-ca",
      title: "Ventilation du chiffre d'affaires 2025",
      origin: "fictive",
      date: "2026-03-31",
      excerpt:
        "Chiffre d'affaires facturé 2025 : 6 200 000 €. Meridian Industries : 3 600 000 €. Trois autres clients : 2 600 000 €.",
    },
    {
      id: "p-signalement",
      title: "Courriel d'un ingénieur R&D",
      origin: "fictive",
      date: "2026-06-14",
      excerpt:
        "« Il me semble que VectorLab a ouvert des documents qui ne concernent pas l'intégration. Je n'ai pas vérifié dans les journaux. »",
    },
    {
      id: "p-revue",
      title: "Revue des habilitations",
      origin: "fictive",
      date: "2026-06-15",
      excerpt:
        "Compte vectorlab-integ : actif. Dernière connexion le 12/06/2026. Périmètre déclaré : dossier « Intégration ». Aucun avenant ni clôture rattaché dans l'outil.",
    },
    // ── Branche A ──
    {
      id: "p-avenant",
      title: "Avenant n° 1 au bon de commande VectorLab",
      origin: "fictive",
      date: "2026-04-20",
      excerpt:
        "Prolongation de la prestation jusqu'au 31/08/2026. Accès maintenu au seul dossier « Intégration ». Signé par la présidente et par VectorLab.",
    },
    {
      id: "p-ag",
      title: "Procès-verbal d'assemblée générale",
      origin: "fictive",
      date: "2026-02-10",
      excerpt:
        "L'assemblée approuve la conversion des obligations au profit de Helix Capital et la licence non exclusive concédée à Meridian Industries.",
    },
    {
      id: "p-journal-a",
      title: "Extrait du journal d'accès, juin 2026",
      origin: "fictive",
      date: "2026-06-16",
      excerpt:
        "Compte vectorlab-integ, du 01/06 au 15/06/2026 : 14 ouvertures de documents, toutes dans le dossier « Intégration ».",
    },
    // ── Branche B ──
    {
      id: "p-fin-mission",
      title: "Procès-verbal de fin de mission VectorLab",
      origin: "fictive",
      date: "2026-04-30",
      excerpt:
        "Fin de la prestation au 30/04/2026, sans prolongation. Les accès de VectorLab devaient être retirés à cette date.",
    },
    {
      id: "p-journal-b",
      title: "Extrait du journal d'accès, juin 2026",
      origin: "fictive",
      date: "2026-06-16",
      excerpt:
        "Compte vectorlab-integ, 12/06/2026 à 22 h 14 : ouverture et téléchargement du fichier « Procédé de dépôt – v7 », situé hors du dossier « Intégration ».",
    },
    {
      id: "p-classification",
      title: "Fiche de classification du document",
      origin: "fictive",
      date: "2025-11-05",
      excerpt:
        "« Procédé de dépôt – v7 » : confidentiel, accès nominatif réservé à l'équipe procédés, document chiffré et registre des consultations.",
    },
  ],
  claims: [
    { id: "c-statuts", statement: "Claire Vidal détient 70 % du capital et des votes ; les investisseurs initiaux 30 %.", nature: "fait_documente", verification: "valide", about: ["fondatrice", "invest-init", "aster"], evidenceIds: ["p-statuts"] },
    { id: "c-repartition-init", statement: "La répartition des parts entre les investisseurs initiaux n'est pas détaillée.", nature: "information_manquante", verification: "non_verifie", about: ["invest-init"], evidenceIds: [] },
    { id: "c-inventaire", statement: "Aster est titulaire du brevet, du logiciel, des données et du procédé.", nature: "fait_documente", verification: "declare", about: ["aster", "brevet", "logiciel", "donnees", "procede", "espace-rd"], evidenceIds: ["p-inventaire"] },
    { id: "c-augmentation", statement: "Après l'augmentation de capital, Helix détient 45 % du capital et des votes.", nature: "fait_documente", verification: "valide", about: ["helix", "aster"], evidenceIds: ["p-augmentation"] },
    { id: "c-pacte", statement: "Le pacte donne à Helix 2 sièges sur 5 et un accord préalable sur toute cession ou licence exclusive du brevet.", nature: "fait_documente", verification: "declare", about: ["helix", "aster", "brevet"], evidenceIds: ["p-pacte"] },
    { id: "c-pret", statement: "Orion a prêté 2 M€ à Aster, garantis par un nantissement du brevet.", nature: "fait_documente", verification: "valide", about: ["orion", "aster", "brevet"], evidenceIds: ["p-pret"] },
    { id: "c-bdc", statement: "La mission de VectorLab court du 01/10/2025 au 30/04/2026, avec un accès limité au dossier « Intégration ».", nature: "fait_documente", verification: "valide", about: ["vectorlab", "espace-rd"], evidenceIds: ["p-bdc"] },
    { id: "c-conversion", statement: "Après conversion, Helix détient 55 % du capital et des votes.", nature: "fait_documente", verification: "valide", about: ["helix", "aster"], evidenceIds: ["p-conversion"] },
    { id: "c-licence", statement: "Meridian bénéficie d'une licence non exclusive et limitée ; Aster reste titulaire du brevet.", nature: "fait_documente", verification: "valide", about: ["meridian", "brevet"], evidenceIds: ["p-licence"] },
    { id: "c-ca", statement: "Meridian représente 3,6 M€ sur 6,2 M€ de chiffre d'affaires 2025, soit 58 %.", nature: "fait_documente", verification: "recoupe", about: ["meridian", "aster"], evidenceIds: ["p-ca"] },
    { id: "c-habilitation", statement: "L'habilitation de VectorLab est active au 15/06/2026, après la fin initiale de mission.", nature: "fait_documente", verification: "valide", about: ["vectorlab", "espace-rd"], evidenceIds: ["p-revue"] },
    { id: "c-signalement", statement: "Un ingénieur signale que VectorLab aurait ouvert des documents hors du dossier « Intégration ».", nature: "allegation", verification: "non_verifie", about: ["vectorlab", "espace-rd"], evidenceIds: ["p-signalement"] },
    { id: "c-avenant-absent", statement: "Aucun avenant ni aucune clôture de la mission VectorLab n'est au dossier.", nature: "information_manquante", verification: "non_verifie", about: ["vectorlab"], evidenceIds: [] },
    { id: "c-detenteurs-helix", statement: "Les détenteurs et bénéficiaires effectifs de Helix ne sont pas documentés.", nature: "information_manquante", verification: "non_verifie", about: ["helix"], evidenceIds: [] },
    { id: "c-ief", statement: "Le dossier ne dit pas si l'activité d'Aster relève du contrôle des investissements étrangers.", nature: "information_manquante", verification: "non_verifie", about: ["aster", "helix"], evidenceIds: [] },
    { id: "c-hyp-acces-prolonge", statement: "L'accès de VectorLab a pu être prolongé par un avenant non transmis.", nature: "hypothese", verification: "non_verifie", about: ["vectorlab"], evidenceIds: [] },
    { id: "c-hyp-acces-illicite", statement: "VectorLab a pu accéder sans autorisation à des documents protégés.", nature: "hypothese", verification: "non_verifie", about: ["vectorlab", "procede"], evidenceIds: [] },
    // ── Branches ──
    { id: "c-avenant", statement: "Un avenant prolonge la mission jusqu'au 31/08/2026 avec un accès limité au dossier « Intégration ».", nature: "fait_documente", verification: "valide", about: ["vectorlab"], evidenceIds: ["p-avenant"] },
    { id: "c-ag", statement: "L'assemblée a approuvé la conversion et la licence.", nature: "fait_documente", verification: "valide", about: ["aster", "helix", "meridian"], evidenceIds: ["p-ag"] },
    { id: "c-journal-a", statement: "En juin 2026, les ouvertures de documents du compte VectorLab restent dans le dossier « Intégration ».", nature: "fait_documente", verification: "valide", about: ["vectorlab", "espace-rd"], evidenceIds: ["p-journal-a"] },
    { id: "c-fin-mission", statement: "La mission de VectorLab a pris fin le 30/04/2026, sans prolongation.", nature: "fait_documente", verification: "valide", about: ["vectorlab"], evidenceIds: ["p-fin-mission"] },
    { id: "c-acces-procede", statement: "Le 12/06/2026, le compte VectorLab a ouvert et téléchargé « Procédé de dépôt – v7 », hors de son périmètre.", nature: "fait_documente", verification: "valide", about: ["vectorlab", "procede", "espace-rd"], evidenceIds: ["p-journal-b", "p-classification"] },
  ],
  steps: [
    {
      id: "t0",
      marker: "T0",
      title: "La situation de départ",
      question: "Quels actifs comptent pour Aster, et qui la contrôle ?",
      asOf: "2025-01-15",
      reveals: ["p-statuts", "p-inventaire"],
      raises: ["c-repartition-init"],
      explanation:
        "À T0, les statuts et le registre des mouvements de titres établissent que Claire Vidal détient 70 % des votes : la majorité est documentée. On repère aussi quatre actifs importants (brevet, logiciel, données, procédé) et l'espace documentaire où vit le savoir-faire. La conclusion reste limitée aux pièces : un accord non communiqué pourrait aménager les droits.",
      exercise: {
        id: "ex-t0",
        kind: "qualification",
        prompt: "Claire Vidal détient 70 % du capital et des votes. Que pouvez-vous affirmer ?",
        options: [
          { id: "a", label: "Elle détient la majorité des votes d'après les statuts ; d'autres droits pourraient exister hors du dossier.", verdict: "juste", feedback: "C'est exactement ce que les pièces permettent d'affirmer, avec leur limite." },
          { id: "b", label: "Elle contrôle Aster de façon certaine et définitive.", verdict: "partiel", feedback: "La majorité est documentée, mais « certaine et définitive » va au-delà des pièces : un pacte non communiqué pourrait aménager les droits, et le capital évoluera." },
          { id: "c", label: "On ne peut rien dire sans le registre des bénéficiaires effectifs.", verdict: "faux", feedback: "Les statuts et le registre des mouvements de titres suffisent à établir la répartition du capital. Le registre des bénéficiaires effectifs est une déclaration utile, pas la seule pièce." },
        ],
      },
    },
    {
      id: "t1",
      marker: "T1",
      title: "La levée de fonds",
      question: "Faut-il attendre 50 % pour parler de contrôle ?",
      asOf: "2025-07-01",
      reveals: ["p-augmentation", "p-pacte"],
      raises: ["c-detenteurs-helix", "c-ief"],
      explanation:
        "Helix détient 45 % des votes et aucun autre associé n'en détient davantage : l'article L. 233-3 II du Code de commerce présume alors le contrôle. Le pacte lui donne aussi 2 sièges sur 5 et un accord préalable sur la cession du brevet. Rien de cela n'établit une intention : une levée de fonds est une opération ordinaire. Helix étant établie hors de l'Union européenne, la question du contrôle des investissements étrangers se pose ; sa réponse n'est pas au dossier.",
      exercise: {
        id: "ex-t1",
        kind: "qualification",
        prompt: "Helix détient 45 % du capital et des votes, et aucun autre associé n'en détient davantage. Que retenez-vous ?",
        options: [
          { id: "a", label: "Helix contrôle Aster puisqu'elle est le premier actionnaire.", verdict: "faux", feedback: "Être premier actionnaire ne suffit pas. Au-delà de 40 % des votes sans détenteur supérieur, le contrôle est présumé : c'est une présomption à examiner, pas un contrôle acquis." },
          { id: "b", label: "Helix ne contrôle pas Aster, car elle n'atteint pas 50 %.", verdict: "faux", feedback: "Moins de 50 % ne prouve pas l'absence de contrôle. Au-delà de 40 % sans détenteur supérieur, le contrôle est présumé, et le pacte ajoute des droits sur le brevet." },
          { id: "c", label: "Le contrôle de Helix est présumé (plus de 40 %, aucun détenteur supérieur) ; le pacte doit être lu pour mesurer ses droits réels.", verdict: "juste", feedback: "Oui : présomption de l'article L. 233-3 II, et lecture du pacte pour les droits de nomination et de veto." },
          { id: "d", label: "Les informations sont insuffisantes pour conclure quoi que ce soit.", verdict: "partiel", feedback: "Prudent, mais les pièces permettent déjà d'énoncer une présomption de contrôle et de lire les droits du pacte." },
        ],
      },
    },
    {
      id: "t2",
      marker: "T2",
      title: "La conversion",
      question: "Qu'est-ce qui change, et qu'est-ce qui ne change pas ?",
      asOf: "2026-01-20",
      reveals: ["p-pret", "p-bdc", "p-conversion"],
      explanation:
        "Après la conversion, Helix détient 55 % des votes : la majorité est documentée, Claire Vidal passe à 31,5 %. Un changement de contrôle peut créer des obligations (information des partenaires, éventuel contrôle des investissements étrangers) ; il ne qualifie pas une intention. Les détenteurs de Helix restent inconnus : c'est une information manquante, pas un indice de dissimulation. Entre-temps, Orion a prêté 2 M€ contre un nantissement du brevet, et VectorLab a commencé sa mission.",
      exercise: {
        id: "ex-t2",
        kind: "qualification",
        prompt: "Après conversion, Helix détient 55 % des votes. Quelle formulation est la plus juste ?",
        options: [
          { id: "a", label: "Helix détient la majorité des votes : le contrôle est documenté. Cela n'établit aucune intention abusive.", verdict: "juste", feedback: "Oui : le fait (majorité) est établi, l'intention ne l'est pas." },
          { id: "b", label: "Helix a pris le contrôle d'Aster pour s'approprier sa technologie.", verdict: "faux", feedback: "Le changement de contrôle est documenté ; la finalité ne l'est pas. Une conversion d'obligations est une opération de financement courante." },
          { id: "c", label: "Rien n'a changé depuis T1.", verdict: "faux", feedback: "On passe d'une présomption (45 %) à une majorité documentée (55 %) : c'est un changement de contrôle." },
        ],
      },
    },
    {
      id: "t3",
      marker: "T3",
      title: "Les dépendances",
      question: "De qui Aster dépend-elle, et dans quel périmètre ?",
      asOf: "2026-03-31",
      reveals: ["p-licence", "p-ca"],
      explanation:
        "Le ratio se lit avec ses entrées : 3 600 000 € sur 6 200 000 € de chiffre d'affaires facturé en 2025, soit 58 %. C'est un facteur de risque pour Aster (perte du client, pression sur les prix), sans intention prêtée à Meridian. La licence est non exclusive et limitée : Aster reste titulaire. Orion détient un nantissement sur le brevet. Ce sont trois dépendances distinctes, à ne pas additionner dans un score.",
      exercise: {
        id: "ex-t3",
        kind: "qualification",
        prompt: "Meridian représente 58 % du chiffre d'affaires 2025 et bénéficie d'une licence du brevet. Que retenez-vous ?",
        options: [
          { id: "a", label: "Une dépendance commerciale mesurée (3,6 M€ sur 6,2 M€ en 2025) et une licence limitée : Aster reste titulaire du brevet.", verdict: "juste", feedback: "Oui : un ratio avec son périmètre, et la distinction entre licence et propriété." },
          { id: "b", label: "Meridian s'est approprié le brevet.", verdict: "faux", feedback: "La licence est non exclusive, limitée à l'automobile en Europe pour 5 ans. Une licence n'est pas une cession." },
          { id: "c", label: "La dépendance est un facteur de risque, donc Meridian est hostile.", verdict: "faux", feedback: "Un facteur de risque décrit une vulnérabilité d'Aster, pas une intention de Meridian." },
          { id: "d", label: "Helix, Orion et Meridian forment un réseau coordonné.", verdict: "faux", feedback: "Aucune pièce ne relie ces acteurs entre eux. Une proximité dans le graphe n'est pas une coordination." },
        ],
      },
    },
    {
      id: "t4",
      marker: "T4",
      title: "L'habilitation à vérifier",
      question: "Que pouvez-vous affirmer sur l'accès de VectorLab ?",
      asOf: "2026-06-15",
      reveals: ["p-signalement", "p-revue"],
      raises: ["c-avenant-absent"],
      explanation:
        "Une habilitation active après la date de fin initiale est un signal faible : il manque une pièce (avenant ou clôture). Le courriel de l'ingénieur est une allégation tant que les journaux ne l'ont pas recoupé. La présence de VectorLab dans le même graphe que Helix n'ajoute aucune preuve.",
      exercise: {
        id: "ex-t4",
        kind: "qualification",
        prompt: "La mission de VectorLab finissait le 30/04/2026 ; son compte est encore actif le 15/06/2026 et un ingénieur signale des consultations hors périmètre.",
        options: [
          { id: "a", label: "C'est un signal à vérifier : une pièce manque (avenant ou clôture) et le signalement est une allégation.", verdict: "juste", feedback: "Oui : un signal faible et une allégation, pas encore un fait établi." },
          { id: "b", label: "VectorLab a commis un accès illicite pour le compte de Helix.", verdict: "faux", feedback: "Rien ne relie VectorLab à Helix, et l'accès illicite n'est pas établi : un avenant peut exister, et le signalement n'est pas vérifié." },
          { id: "c", label: "Aucun problème : la mission a dû être prolongée.", verdict: "faux", feedback: "C'est une hypothèse, pas un fait. Elle se vérifie avec l'avenant." },
          { id: "d", label: "Il faut couper l'accès immédiatement, sans garder de trace.", verdict: "partiel", feedback: "Suspendre un accès peut se justifier, selon la procédure et en conservant les traces. Le faire sans trace empêcherait toute vérification." },
        ],
      },
    },
    {
      id: "hypotheses",
      marker: "Hypothèses",
      title: "Formuler des hypothèses",
      question: "Quelles explications sont possibles ?",
      reveals: [],
      raises: ["c-hyp-acces-prolonge", "c-hyp-acces-illicite"],
      explanation:
        "Une bonne analyse garde plusieurs explications ouvertes, dont au moins une licite, et écarte les accusations sans pièce. La croissance financée, la vulnérabilité contractuelle, l'accès prolongé et l'accès non autorisé sont des hypothèses de travail. La coordination de tous les acteurs ou l'hostilité déduite d'une nationalité n'en sont pas.",
      exercise: {
        id: "ex-hypotheses",
        kind: "hypotheses",
        multiple: true,
        minSelected: 2,
        prompt: "Retenez au moins deux hypothèses à vérifier, dont une explication licite.",
        options: [
          { id: "h1", label: "La croissance d'Aster a été financée légitimement et les opérations sur le capital sont approuvées.", verdict: "juste", feedback: "Explication licite plausible au vu des pièces." },
          { id: "h2", label: "La dépendance à Meridian et le nantissement d'Orion créent une vulnérabilité contractuelle à gérer.", verdict: "juste", feedback: "Hypothèse sur la situation d'Aster, sans intention prêtée aux partenaires." },
          { id: "h3", label: "L'accès de VectorLab a été prolongé par un avenant non transmis.", verdict: "juste", feedback: "Explication licite à vérifier avec l'avenant." },
          { id: "h4", label: "VectorLab a accédé sans autorisation à des documents protégés.", verdict: "juste", feedback: "Hypothèse à vérifier avec les journaux, pas une conclusion." },
          { id: "h5", label: "Helix, Orion, Meridian et VectorLab coordonnent une opération d'espionnage.", verdict: "faux", feedback: "Aucune pièce ne relie ces acteurs : c'est une accusation, pas une hypothèse de travail." },
          { id: "h6", label: "Helix est hostile parce qu'elle est établie hors de l'Union européenne.", verdict: "faux", feedback: "L'établissement ou la nationalité ne démontre pas une intention." },
        ],
      },
    },
    {
      id: "verifications",
      marker: "Vérifications",
      title: "Choisir les pièces utiles",
      question: "Quelles pièces demander en priorité ?",
      reveals: [],
      explanation:
        "Les pièces prioritaires répondent aux questions ouvertes : l'avenant ou la clôture et les journaux d'accès pour VectorLab, le procès-verbal d'assemblée pour la validité des opérations. Les détenteurs de Helix complètent la chaîne de contrôle sans répondre à la question de l'accès. La nationalité des dirigeants ou le fichier clients d'un partenaire ne répondent à aucune question du dossier.",
      exercise: {
        id: "ex-verifications",
        kind: "verifications",
        multiple: true,
        minSelected: 1,
        maxSelected: 3,
        prompt: "Choisissez jusqu'à trois pièces à demander.",
        options: [
          { id: "v1", label: "Avenant ou procès-verbal de clôture de la mission VectorLab", verdict: "juste", feedback: "Répond directement à la pièce manquante." },
          { id: "v2", label: "Journaux d'accès à l'espace documentaire R&D sur la période", verdict: "juste", feedback: "Permet de recouper l'allégation de l'ingénieur." },
          { id: "v3", label: "Procès-verbal d'assemblée approuvant la conversion et la licence", verdict: "juste", feedback: "Établit la validité des opérations sur le capital et la licence." },
          { id: "v4", label: "Détenteurs et bénéficiaires effectifs de Helix", verdict: "partiel", feedback: "Utile pour compléter la chaîne de contrôle, mais sans rapport avec la question de l'accès." },
          { id: "v5", label: "Nationalité des dirigeants de Helix", verdict: "faux", feedback: "Ne répond à aucune question ouverte ; la nationalité n'est pas un indice." },
          { id: "v6", label: "Fichier clients de Meridian", verdict: "faux", feedback: "Hors périmètre et disproportionné." },
        ],
      },
    },
  ],
  branches: [
    {
      id: "branche-a",
      label: "Branche A : l'avenant existe",
      asOf: "2026-06-16",
      reveals: ["p-ag", "p-avenant", "p-journal-a"],
      resolves: [
        { claimId: "c-avenant-absent", outcome: "renseignee", byClaimId: "c-avenant" },
        { claimId: "c-hyp-acces-prolonge", outcome: "confirmee", byClaimId: "c-avenant" },
        { claimId: "c-hyp-acces-illicite", outcome: "infirmee", byClaimId: "c-journal-a" },
        { claimId: "c-signalement", outcome: "infirmee", byClaimId: "c-journal-a" },
      ],
      levels: [
        { level: "signal_faible", statement: "L'habilitation active après la fin initiale de mission était un signal faible ; l'avenant l'explique.", claimIds: ["c-habilitation", "c-avenant"] },
        { level: "facteur_risque", statement: "La dépendance à Meridian (58 % du chiffre d'affaires 2025) et le nantissement du brevet restent des facteurs de risque pour Aster.", claimIds: ["c-ca", "c-pret"] },
        { level: "faisceau", statement: "Aucun faisceau : les éléments troublants sont expliqués par les pièces.", claimIds: [] },
        { level: "preuve", statement: "L'avenant et le journal établissent un accès autorisé et limité au dossier « Intégration ».", claimIds: ["c-avenant", "c-journal-a"] },
      ],
      conclusion:
        "Un avenant valide prolonge la prestation jusqu'au 31/08/2026 et limite l'accès au dossier « Intégration ». Les journaux confirment des ouvertures dans ce seul dossier, et l'assemblée a approuvé la conversion et la licence. L'analyse conclut à une opération légitime comportant des dépendances à gérer.",
      openQuestions: [
        "L'outil d'habilitation n'avait pas rattaché l'avenant : un défaut de suivi à corriger.",
        "Les détenteurs et bénéficiaires effectifs de Helix restent à documenter.",
      ],
      recommendations: [
        "Rattacher chaque habilitation à un contrat et à une date de fin.",
        "Revoir chaque trimestre les accès des prestataires.",
        "Préparer un plan de diversification des clients.",
      ],
      exercise: {
        id: "ex-branche-a",
        kind: "conclusion",
        prompt: "Avec ces pièces, quelle conclusion retenez-vous ?",
        options: [
          { id: "a", label: "Opération légitime ; dépendances à gérer et suivi des habilitations à corriger.", verdict: "juste", feedback: "Oui : les pièces lèvent le signal, sans effacer les vulnérabilités." },
          { id: "b", label: "Espionnage établi : Helix a placé VectorLab.", verdict: "faux", feedback: "Les pièces établissent le contraire pour l'accès, et rien ne relie VectorLab à Helix." },
          { id: "c", label: "Rien à signaler, dossier clos.", verdict: "partiel", feedback: "Le signal est levé, mais la dépendance client et le suivi des habilitations restent à traiter." },
        ],
      },
    },
    {
      id: "branche-b",
      label: "Branche B : l'accès n'était pas autorisé",
      asOf: "2026-06-16",
      reveals: ["p-fin-mission", "p-journal-b", "p-classification"],
      resolves: [
        { claimId: "c-avenant-absent", outcome: "renseignee", byClaimId: "c-fin-mission" },
        { claimId: "c-hyp-acces-prolonge", outcome: "infirmee", byClaimId: "c-fin-mission" },
        { claimId: "c-hyp-acces-illicite", outcome: "confirmee", byClaimId: "c-acces-procede" },
        { claimId: "c-signalement", outcome: "confirmee", byClaimId: "c-acces-procede" },
      ],
      levels: [
        { level: "signal_faible", statement: "L'habilitation active après la fin de mission était un signal faible.", claimIds: ["c-habilitation"] },
        { level: "facteur_risque", statement: "La dépendance à Meridian et le nantissement du brevet restent des facteurs de risque, sans lien établi avec l'incident.", claimIds: ["c-ca", "c-pret"] },
        { level: "faisceau", statement: "Fin de mission, compte resté actif et signalement convergent vers un accès hors périmètre.", claimIds: ["c-fin-mission", "c-habilitation", "c-signalement"] },
        { level: "preuve", statement: "Le journal et la fiche de classification établissent l'ouverture d'un document protégé, sans autorisation. Ils ne prouvent ni commanditaire ni coordination.", claimIds: ["c-acces-procede"] },
      ],
      conclusion:
        "Les pièces établissent l'absence d'autorisation après le 30/04/2026 et l'ouverture, le 12/06/2026, du document « Procédé de dépôt – v7 », protégé. L'incident appelle protection, qualification et investigation. Il n'établit ni coordination avec Helix, ni commanditaire, ni espionnage imputable à l'ensemble du réseau.",
      openQuestions: [
        "Qui a utilisé le compte, et dans quel but ?",
        "Le document a-t-il été transmis au-delà du téléchargement ?",
        "La qualification juridique (atteinte au secret des affaires, accès frauduleux) relève d'un examen compétent.",
      ],
      recommendations: [
        "Suspendre le compte selon la procédure, en conservant les traces.",
        "Préserver les journaux et qualifier l'incident avec la sécurité et le juriste.",
        "Revoir la gestion des fins de mission (moindre privilège, retrait des accès).",
      ],
      exercise: {
        id: "ex-branche-b",
        kind: "conclusion",
        prompt: "Avec ces pièces, quelle conclusion retenez-vous ?",
        options: [
          { id: "a", label: "Un accès non autorisé à un document protégé est établi ; ni commanditaire ni coordination ne le sont.", verdict: "juste", feedback: "Oui : un fait précis est documenté ; la qualification et l'attribution plus large exigent d'autres éléments." },
          { id: "b", label: "Helix a commandité l'espionnage d'Aster.", verdict: "faux", feedback: "Aucune pièce ne relie l'accès à Helix. La proximité dans le graphe n'est pas une preuve." },
          { id: "c", label: "Rien n'est établi tant qu'il n'y a pas de condamnation.", verdict: "faux", feedback: "Le procès-verbal de fin de mission et le journal établissent un fait précis : l'accès non autorisé. La qualification juridique, elle, reste à faire." },
        ],
      },
    },
  ],
};

/** Scénario validé au chargement : une incohérence casse le build et les tests. */
export const ASTER_SCENARIO = Scenario.parse(aster);
