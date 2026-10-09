import { Scenario } from "../schema";

/**
 * Démonstrateur « Le paiement de Nova » (cadrage §5).
 *
 * TOUS LES NOMS, ADRESSES, PIÈCES ET MONTANTS SONT FICTIFS. Les adresses
 * « 0xFICTIF… » et les jetons S-EUR, U-USD et ALPHA n'existent pas ; aucun
 * n'est associé à une promesse réelle de stabilité ou de conformité.
 * Chaque montant est conservé dans son unité : on n'additionne jamais des
 * S-EUR, des U-USD et des ALPHA.
 */
const nova = {
  id: "paiement-nova",
  version: "1.0.0",
  title: "Le paiement de Nova",
  fiction: true,
  summary:
    "Nova, entreprise française, règle une prestation de design à Lumen Studio en jeton stable fictif S-EUR, acheté chez le prestataire PorteX. Une nouvelle instruction de paiement change l'adresse et le bénéficiaire.",
  subjectId: "nova",
  bands: [
    { label: "Acteurs", y: 90 },
    { label: "Comptes et adresses", y: 300 },
    { label: "Prestataires et infrastructures", y: 510 },
  ],
  layout: {
    nova: { x: 110, y: 90, label: "above" },
    kappa: { x: 610, y: 90, label: "above" },
    lumen: { x: 900, y: 90, label: "above" },
    "compte-nova-banque": { x: 110, y: 300 },
    "compte-nova-portex": { x: 340, y: 300 },
    "adresse-dest": { x: 610, y: 300 },
    "adresse-portey": { x: 790, y: 300 },
    "adresse-contrat": { x: 935, y: 300 },
    "banque-a": { x: 110, y: 510 },
    portex: { x: 340, y: 510 },
    "contrat-echange": { x: 610, y: 510 },
    portey: { x: 790, y: 510 },
  },
  observers: [
    {
      id: "banque",
      label: "Banque A",
      sees: "Le titulaire du compte, le virement en euros et son justificatif.",
      limit: "N'observe ni les écritures internes de PorteX ni la chaîne.",
    },
    {
      id: "prestataire",
      label: "PorteX",
      sees: "Son client Nova, le dépôt en euros, l'achat de S-EUR, l'envoi vers l'adresse saisie et les informations de transfert.",
      limit: "Ne connaît pas automatiquement le titulaire d'une adresse extérieure.",
    },
    {
      id: "analyste",
      label: "Analyste de flux",
      sees: "Les transactions publiques du réseau Alpha et les attributions publiées.",
      limit: "Ne voit ni les virements ni les écritures internes ; un regroupement d'adresses est une inférence.",
    },
    {
      id: "autorite",
      label: "Autorité ou enquêteur",
      sees: "Les données publiques et les pièces obtenues dans un cadre légal.",
      limit: "Dans le Lab, cette perspective est simulée : aucune pièce confidentielle n'est accessible.",
    },
  ],
  actors: [
    { id: "nova", kind: "entreprise", name: "Nova", roles: ["Payeur", "Entreprise étudiée"], country: "France", origin: "fictive" },
    { id: "lumen", kind: "entreprise", name: "Lumen Studio", roles: ["Prestataire de design", "Bénéficiaire déclaré"], country: "Hors Union européenne", origin: "fictive" },
    { id: "kappa", kind: "prestataire_crypto", name: "Kappa Payments", roles: ["Nommée dans l'instruction de paiement"], origin: "fictive" },
    { id: "banque-a", kind: "banque", name: "Banque A", roles: ["Banque de Nova"], country: "France", origin: "fictive" },
    { id: "portex", kind: "prestataire_crypto", name: "PorteX", roles: ["Prestataire de services sur cryptoactifs de Nova"], country: "France", origin: "fictive" },
    { id: "portey", kind: "prestataire_crypto", name: "PorteY", roles: ["Plateforme d'échange"], country: "Hors Union européenne", origin: "fictive" },
  ],
  resources: [
    { id: "compte-nova-banque", kind: "compte_bancaire", label: "Compte courant de Nova", identifier: "FR76 FICTIF", origin: "fictive" },
    { id: "compte-nova-portex", kind: "compte_prestataire", label: "Compte de Nova chez PorteX", origin: "fictive" },
    { id: "adresse-dest", kind: "adresse", label: "Adresse 0xFICTIF…D3ST", network: "Réseau Alpha (fictif)", identifier: "0xFICTIF…D3ST", origin: "fictive" },
    { id: "adresse-contrat", kind: "adresse", label: "Adresse convenue", network: "Réseau Alpha (fictif)", identifier: "0xFICTIF…A11", origin: "fictive" },
    { id: "adresse-portey", kind: "adresse", label: "Adresse de dépôt PorteY", network: "Réseau Alpha (fictif)", identifier: "0xFICTIF…P0RT", origin: "fictive" },
    { id: "contrat-echange", kind: "contrat_intelligent", label: "Contrat d'échange S-EUR / U-USD", network: "Réseau Alpha (fictif)", origin: "fictive" },
  ],
  relations: [
    { id: "contrat-design", kind: "prestation", source: "lumen", target: "nova", label: "prestation de design", rights: "Identité visuelle de la gamme Nova 2027, 49 850,00 € payables en S-EUR", validFrom: "2026-07-15", claimIds: ["c-contrat"] },
    { id: "lumen-adresse-contrat", kind: "titulaire_compte", source: "lumen", target: "adresse-contrat", label: "adresse convenue", validFrom: "2026-07-15", claimIds: ["c-contrat"] },
    { id: "tit-compte-banque", kind: "titulaire_compte", source: "nova", target: "compte-nova-banque", label: "titulaire", validFrom: "2020-01-01", claimIds: ["c-releve-a"] },
    { id: "tenue-compte-banque", kind: "prestation", source: "banque-a", target: "compte-nova-banque", label: "tient le compte", validFrom: "2020-01-01", claimIds: ["c-releve-a"] },
    { id: "tit-compte-portex", kind: "titulaire_compte", source: "nova", target: "compte-nova-portex", label: "titulaire", validFrom: "2026-09-01", claimIds: ["c-avis-achat"] },
    { id: "conservation-portex", kind: "prestation", source: "portex", target: "compte-nova-portex", label: "conserve", rights: "Conservation et transfert de cryptoactifs pour le compte de Nova", validFrom: "2026-09-01", claimIds: ["c-registre"] },
    { id: "portey-adresse", kind: "titulaire_compte", source: "portey", target: "adresse-portey", label: "adresse de dépôt", validFrom: "2026-06-01", claimIds: ["c-attribution-portey"] },
    {
      id: "kappa-adresse",
      kind: "titulaire_compte",
      source: "kappa",
      target: "adresse-dest",
      label: "titulaire",
      validFrom: "2026-09-07",
      claimIds: ["c-instruction-dit", "c-attestation-kappa"],
    },
    {
      id: "kappa-lumen",
      kind: "prestation",
      source: "kappa",
      target: "lumen",
      label: "mandat d'encaissement",
      validFrom: "2026-09-01",
      claimIds: ["c-instruction-dit", "c-mandat"],
    },
  ],
  events: [
    {
      id: "e-virement",
      label: "Virement de Nova vers PorteX",
      occurredOn: "2026-09-14",
      layer: "fiat",
      legs: [{ from: "compte-nova-banque", to: "compte-nova-portex", amount: { value: "50000.00", unit: "EUR" }, role: "envoi" }],
      status: "confirme",
      visibleTo: ["banque", "prestataire", "autorite"],
      claimIds: ["c-releve-a"],
    },
    {
      id: "e-achat",
      label: "Achat de S-EUR chez PorteX",
      occurredOn: "2026-09-14",
      layer: "interne",
      legs: [
        { from: "compte-nova-portex", to: "portex", amount: { value: "49850.00", unit: "EUR" }, role: "conversion_entree" },
        { from: "portex", to: "compte-nova-portex", amount: { value: "49850.00", unit: "S-EUR" }, role: "conversion_sortie" },
        { from: "compte-nova-portex", to: "portex", amount: { value: "150.00", unit: "EUR" }, role: "frais" },
      ],
      status: "confirme",
      visibleTo: ["prestataire", "autorite"],
      claimIds: ["c-avis-achat"],
    },
    {
      id: "e-envoi",
      label: "Envoi vers l'adresse 0xFICTIF…D3ST",
      occurredOn: "2026-09-15",
      network: "Réseau Alpha (fictif)",
      layer: "chaine",
      legs: [
        { from: "compte-nova-portex", to: "adresse-dest", amount: { value: "49850.00", unit: "S-EUR" }, role: "envoi" },
        { from: "portex", amount: { value: "0.0021", unit: "ALPHA" }, role: "frais" },
      ],
      status: "confirme",
      visibleTo: ["prestataire", "analyste", "autorite"],
      claimIds: ["c-envoi"],
    },
    {
      id: "e-echange",
      label: "Échange S-EUR contre U-USD",
      occurredOn: "2026-09-15",
      network: "Réseau Alpha (fictif)",
      layer: "chaine",
      legs: [
        { from: "adresse-dest", to: "contrat-echange", amount: { value: "49700.45", unit: "S-EUR" }, role: "conversion_entree" },
        { from: "adresse-dest", to: "contrat-echange", amount: { value: "149.55", unit: "S-EUR" }, role: "frais" },
        { from: "contrat-echange", to: "adresse-dest", amount: { value: "53760.85", unit: "U-USD" }, role: "conversion_sortie" },
        { from: "adresse-dest", amount: { value: "0.0018", unit: "ALPHA" }, role: "frais" },
      ],
      status: "confirme",
      visibleTo: ["analyste", "autorite"],
      claimIds: ["c-echange"],
    },
    {
      id: "e-depot",
      label: "Dépôt sur l'adresse de PorteY",
      occurredOn: "2026-09-16",
      network: "Réseau Alpha (fictif)",
      layer: "chaine",
      legs: [
        { from: "adresse-dest", to: "adresse-portey", amount: { value: "53760.85", unit: "U-USD" }, role: "envoi" },
        { from: "adresse-dest", amount: { value: "0.0015", unit: "ALPHA" }, role: "frais" },
      ],
      status: "confirme",
      visibleTo: ["analyste", "autorite"],
      claimIds: ["c-depot"],
    },
    {
      id: "e-reversement",
      label: "Reversement en euros de Kappa à Lumen (banque B)",
      occurredOn: "2026-09-16",
      layer: "fiat",
      legs: [{ from: "kappa", to: "lumen", amount: { value: "49600.75", unit: "EUR" }, role: "envoi" }],
      status: "confirme",
      visibleTo: ["autorite"],
      branchId: "branche-a",
      claimIds: ["c-releve-b"],
    },
  ],
  evidence: [
    {
      id: "p-contrat",
      title: "Contrat de prestation Nova – Lumen Studio",
      origin: "fictive",
      date: "2026-07-15",
      excerpt:
        "Lumen Studio réalise l'identité visuelle de la gamme Nova 2027. Prix : 49 850,00 €, payables en S-EUR sur le réseau Alpha à l'adresse 0xFICTIF…A11 de Lumen. Tout changement de coordonnées de paiement est confirmé par un écrit signé.",
    },
    {
      id: "p-facture",
      title: "Facture LUM-2026-031",
      origin: "fictive",
      date: "2026-09-01",
      excerpt: "Montant : 49 850,00 €. Bénéficiaire : Lumen Studio. Règlement en S-EUR à l'adresse 0xFICTIF…A11, au plus tard le 15/09/2026.",
    },
    {
      id: "p-registre",
      title: "Extrait du registre des prestataires (fictif)",
      origin: "fictive",
      date: "2026-09-14",
      excerpt: "PorteX : prestataire de services sur cryptoactifs autorisé pour la conservation et le transfert, à la date du 14/09/2026.",
    },
    {
      id: "p-releve-a",
      title: "Relevé du compte de Nova, banque A",
      origin: "fictive",
      date: "2026-09-14",
      excerpt: "14/09/2026 : virement SEPA de 50 000,00 € vers PorteX, référence « Achat S-EUR, facture LUM-2026-031 ».",
    },
    {
      id: "p-avis-portex",
      title: "Avis d'opéré PorteX",
      origin: "fictive",
      date: "2026-09-15",
      excerpt:
        "14/09 : réception de 50 000,00 € ; achat de 49 850,00 S-EUR au cours fictif de 1 S-EUR pour 1 €, frais 150,00 €. 15/09 : envoi de 49 850,00 S-EUR vers l'adresse 0xFICTIF…D3ST (réseau Alpha), saisie par le client. Frais de réseau pris en charge par PorteX.",
    },
    {
      id: "p-tx-alpha",
      title: "Extrait d'un explorateur du réseau Alpha (fictif)",
      origin: "fictive",
      date: "2026-09-16",
      excerpt:
        "15/09 : 0x…D3ST reçoit 49 850,00 S-EUR. 15/09 : 0x…D3ST remet 49 850,00 S-EUR au contrat d'échange (dont 149,55 S-EUR de frais) et reçoit 53 760,85 U-USD. 16/09 : 0x…D3ST envoie 53 760,85 U-USD à 0x…P0RT. Frais de réseau payés en ALPHA.",
    },
    {
      id: "p-portey-doc",
      title: "Page d'aide de PorteY (fictive)",
      origin: "fictive",
      date: "2026-06-01",
      excerpt:
        "Les dépôts U-USD se font sur l'adresse 0xFICTIF…P0RT. Ils sont crédités au client grâce à une référence de dépôt, qui n'apparaît pas sur la chaîne.",
    },
    {
      id: "p-instruction",
      title: "Courriel « Nouvelles coordonnées de paiement »",
      origin: "fictive",
      date: "2026-09-07",
      excerpt:
        "« Merci de régler la facture LUM-2026-031 à Lumen Studio c/o Kappa Payments, notre nouveau prestataire d'encaissement, à l'adresse 0xFICTIF…D3ST. » Aucun document signé n'est joint.",
    },
    // ── Branche A ──
    {
      id: "p-appel-a",
      title: "Compte rendu d'appel au contact habituel de Lumen",
      origin: "fictive",
      date: "2026-09-19",
      excerpt:
        "Appel au numéro figurant au contrat. Lumen confirme avoir confié l'encaissement à Kappa Payments le 01/09/2026 et envoyé la nouvelle adresse ; elle reconnaît ne pas avoir joint l'écrit signé.",
    },
    {
      id: "p-mandat",
      title: "Mandat d'encaissement Lumen – Kappa Payments",
      origin: "fictive",
      date: "2026-09-01",
      excerpt: "Lumen mandate Kappa Payments pour encaisser ses règlements en cryptoactifs et les lui reverser en euros, moyennant 0,5 % de frais.",
    },
    {
      id: "p-attestation-kappa",
      title: "Attestation de Kappa Payments",
      origin: "fictive",
      date: "2026-09-20",
      excerpt:
        "Kappa Payments détient l'adresse 0xFICTIF…D3ST. Elle convertit les encaissements en U-USD pour sa trésorerie chez PorteY, puis reverse les euros à ses mandants.",
    },
    {
      id: "p-releve-b",
      title: "Avis de crédit de Lumen, banque B",
      origin: "fictive",
      date: "2026-09-21",
      excerpt: "16/09/2026 : crédit de 49 600,75 € reçu de Kappa Payments, référence LUM-2026-031.",
    },
    // ── Branche B ──
    {
      id: "p-appel-b",
      title: "Compte rendu d'appel au contact habituel de Lumen",
      origin: "fictive",
      date: "2026-09-19",
      excerpt:
        "Appel au numéro figurant au contrat. Lumen n'a envoyé aucune nouvelle instruction, ne connaît pas Kappa Payments ni l'adresse 0xFICTIF…D3ST, et attend toujours le paiement.",
    },
    {
      id: "p-entetes",
      title: "Analyse de l'en-tête du courriel",
      origin: "fictive",
      date: "2026-09-19",
      excerpt:
        "Expéditeur : facturation@lumen-studlo.example. Domaine habituel de Lumen : lumen-studio.example. Le domaine de l'expéditeur a été créé le 02/09/2026.",
    },
    {
      id: "p-transfert-portex",
      title: "Informations de transfert conservées par PorteX",
      origin: "fictive",
      date: "2026-09-20",
      excerpt:
        "Donneur d'ordre : Nova. Bénéficiaire déclaré par Nova : « Lumen Studio c/o Kappa Payments ». Adresse auto-hébergée ; bénéficiaire déclaré par le donneur d'ordre.",
    },
  ],
  claims: [
    { id: "c-contrat", statement: "Le contrat prévoit 49 850,00 € payables en S-EUR à l'adresse 0xFICTIF…A11 de Lumen, et un écrit signé pour tout changement de coordonnées.", nature: "fait_documente", verification: "valide", about: ["nova", "lumen", "adresse-contrat"], evidenceIds: ["p-contrat"] },
    { id: "c-facture", statement: "La facture LUM-2026-031 demande 49 850,00 € pour Lumen Studio, à l'adresse 0xFICTIF…A11.", nature: "fait_documente", verification: "declare", about: ["lumen", "adresse-contrat"], evidenceIds: ["p-facture"] },
    { id: "c-registre", statement: "PorteX est autorisée pour la conservation et le transfert de cryptoactifs à la date de l'opération (registre fictif).", nature: "fait_documente", verification: "valide", about: ["portex"], evidenceIds: ["p-registre"] },
    { id: "c-releve-a", statement: "Le 14/09/2026, Nova a viré 50 000,00 € de son compte en banque A vers PorteX.", nature: "fait_documente", verification: "valide", about: ["nova", "banque-a", "compte-nova-banque"], evidenceIds: ["p-releve-a"] },
    { id: "c-avis-achat", statement: "PorteX a converti 49 850,00 € en 49 850,00 S-EUR pour Nova, avec 150,00 € de frais : une écriture interne, invisible sur la chaîne.", nature: "fait_documente", verification: "valide", about: ["portex", "compte-nova-portex"], evidenceIds: ["p-avis-portex"] },
    { id: "c-envoi", statement: "Le 15/09/2026, PorteX a envoyé 49 850,00 S-EUR de Nova à l'adresse 0xFICTIF…D3ST.", nature: "fait_documente", verification: "recoupe", about: ["portex", "adresse-dest"], evidenceIds: ["p-avis-portex", "p-tx-alpha"] },
    { id: "c-echange", statement: "L'adresse 0xFICTIF…D3ST a échangé 49 850,00 S-EUR (dont 149,55 de frais) contre 53 760,85 U-USD.", nature: "fait_documente", verification: "valide", about: ["adresse-dest", "contrat-echange"], evidenceIds: ["p-tx-alpha"] },
    { id: "c-depot", statement: "Le 16/09/2026, l'adresse 0xFICTIF…D3ST a envoyé 53 760,85 U-USD à l'adresse de dépôt de PorteY.", nature: "fait_documente", verification: "valide", about: ["adresse-dest", "adresse-portey"], evidenceIds: ["p-tx-alpha"] },
    { id: "c-attribution-portey", statement: "L'adresse 0xFICTIF…P0RT est une adresse de dépôt publiée par PorteY ; le client crédité n'apparaît pas sur la chaîne.", nature: "fait_documente", verification: "declare", about: ["portey", "adresse-portey"], evidenceIds: ["p-portey-doc"] },
    { id: "c-dest-inconnue", statement: "Aucune pièce n'attribue l'adresse 0xFICTIF…D3ST à une personne.", nature: "information_manquante", verification: "non_verifie", about: ["adresse-dest"], evidenceIds: [] },
    { id: "c-client-portey", statement: "Le client de PorteY crédité du dépôt n'est pas connu.", nature: "information_manquante", verification: "non_verifie", about: ["portey", "adresse-portey"], evidenceIds: [] },
    { id: "c-sortie-inconnue", statement: "Aucune pièce ne documente une vente chez PorteY ni un crédit bancaire au bénéficiaire.", nature: "information_manquante", verification: "non_verifie", about: ["portey", "lumen"], evidenceIds: [] },
    { id: "c-instruction-recue", statement: "Le 07/09/2026, Nova a reçu par courriel une instruction désignant « Lumen Studio c/o Kappa Payments » et l'adresse 0xFICTIF…D3ST, sans écrit signé.", nature: "fait_documente", verification: "valide", about: ["nova", "lumen", "kappa", "adresse-dest"], evidenceIds: ["p-instruction"] },
    { id: "c-instruction-dit", statement: "Selon l'instruction, Kappa Payments encaisse pour Lumen et détient l'adresse 0xFICTIF…D3ST.", nature: "allegation", verification: "non_verifie", about: ["kappa", "lumen", "adresse-dest"], evidenceIds: ["p-instruction"] },
    { id: "c-discordance", statement: "L'adresse payée et le bénéficiaire désigné diffèrent du contrat et de la facture.", nature: "fait_documente", verification: "recoupe", about: ["nova", "lumen", "adresse-dest", "adresse-contrat"], evidenceIds: ["p-contrat", "p-facture", "p-instruction"] },
    { id: "c-hyp-mandat", statement: "Lumen a mandaté Kappa Payments et changé d'adresse en toute légitimité.", nature: "hypothese", verification: "non_verifie", about: ["lumen", "kappa"], evidenceIds: [] },
    { id: "c-hyp-erreur", statement: "L'instruction contient une erreur documentaire (adresse ou nom mal reportés).", nature: "hypothese", verification: "non_verifie", about: ["lumen"], evidenceIds: [] },
    { id: "c-hyp-substitution", statement: "Un tiers a substitué les coordonnées de paiement de Lumen.", nature: "hypothese", verification: "non_verifie", about: ["lumen", "adresse-dest"], evidenceIds: [] },
    // ── Branche A ──
    { id: "c-confirmation", statement: "Jointe par son canal habituel, Lumen confirme le mandat de Kappa Payments et la nouvelle adresse.", nature: "fait_documente", verification: "valide", about: ["lumen", "kappa"], evidenceIds: ["p-appel-a"] },
    { id: "c-mandat", statement: "Un mandat du 01/09/2026 charge Kappa Payments d'encaisser pour Lumen et de lui reverser les euros, à 0,5 % de frais.", nature: "fait_documente", verification: "valide", about: ["kappa", "lumen"], evidenceIds: ["p-mandat"] },
    { id: "c-attestation-kappa", statement: "Kappa Payments atteste détenir l'adresse 0xFICTIF…D3ST et y gérer sa trésorerie (échange, dépôt chez PorteY).", nature: "fait_documente", verification: "declare", about: ["kappa", "adresse-dest", "portey"], evidenceIds: ["p-attestation-kappa"] },
    { id: "c-releve-b", statement: "Le 16/09/2026, Lumen a reçu 49 600,75 € de Kappa Payments en banque B.", nature: "fait_documente", verification: "valide", about: ["lumen", "kappa"], evidenceIds: ["p-releve-b"] },
    // ── Branche B ──
    { id: "c-dementi", statement: "Jointe par son canal habituel, Lumen dément avoir envoyé l'instruction ; elle ne connaît ni Kappa Payments ni l'adresse 0xFICTIF…D3ST.", nature: "fait_documente", verification: "valide", about: ["lumen", "kappa", "adresse-dest"], evidenceIds: ["p-appel-b"] },
    { id: "c-domaine", statement: "Le courriel provient d'un domaine proche de celui de Lumen, créé cinq jours avant l'envoi.", nature: "fait_documente", verification: "valide", about: ["lumen"], evidenceIds: ["p-entetes"] },
    { id: "c-transfert-portex", statement: "Le bénéficiaire transmis par PorteX est celui que Nova a déclaré ; PorteX n'a pas attribué l'adresse.", nature: "fait_documente", verification: "declare", about: ["portex", "adresse-dest"], evidenceIds: ["p-transfert-portex"] },
  ],
  steps: [
    {
      id: "situation",
      marker: "Situation",
      title: "La situation initiale",
      question: "Qui paie, pour quoi, et à qui ?",
      asOf: "2026-09-01",
      reveals: ["p-contrat", "p-facture"],
      explanation:
        "Nova paie une prestation de design à Lumen Studio, en S-EUR, à l'adresse prévue au contrat. Une opération internationale réglée en cryptoactif n'est pas une fraude en soi. Ce qui compte d'abord : le payeur, la prestation, le bénéficiaire déclaré et les coordonnées convenues. Le statut du prestataire et la qualification du jeton se vérifient ensuite.",
      exercise: {
        id: "ex-situation",
        kind: "qualification",
        prompt: "Nova règle un prestataire établi hors de l'Union européenne en jeton stable. Que retenez-vous ?",
        options: [
          { id: "a", label: "Une opération internationale en cryptoactif n'est pas suspecte en soi : il faut identifier payeur, prestation, bénéficiaire et coordonnées convenues.", verdict: "juste", feedback: "Oui : on commence par décrire l'opération à partir des pièces." },
          { id: "b", label: "Le recours à un cryptoactif signale un blanchiment.", verdict: "faux", feedback: "Le moyen de paiement ne qualifie pas une intention. Les indicateurs du GAFI orientent une vérification ; isolés, ils ne démontrent rien." },
          { id: "c", label: "Un prestataire établi hors de l'Union européenne impose de refuser l'opération.", verdict: "faux", feedback: "L'établissement d'une contrepartie est une information de contexte, pas un indice d'intention." },
          { id: "d", label: "Il faut d'abord vérifier que S-EUR est conforme à MiCA.", verdict: "partiel", feedback: "La qualification du jeton et le statut du prestataire comptent, mais ils ne disent pas qui paie qui ni pour quoi." },
        ],
      },
    },
    {
      id: "parcours",
      marker: "Parcours",
      title: "Le parcours du paiement",
      question: "Où passe-t-on de l'euro au jeton, et que sait-on de la destination ?",
      asOf: "2026-09-16",
      reveals: ["p-registre", "p-releve-a", "p-avis-portex", "p-tx-alpha", "p-portey-doc"],
      raises: ["c-dest-inconnue", "c-client-portey", "c-sortie-inconnue"],
      boundary:
        "Au-delà du dépôt sur l'adresse de PorteY, aucune pièce ne documente une vente ni un crédit bancaire. Le titulaire de l'adresse 0xFICTIF…D3ST n'est pas documenté.",
      explanation:
        "Les euros quittent la banque A ; l'achat de S-EUR est une écriture interne de PorteX, invisible sur la chaîne. Sur la chaîne, l'adresse 0xFICTIF…D3ST reçoit les S-EUR, les échange contre des U-USD, puis les dépose sur une adresse de PorteY. Les montants restent dans leur unité : 49 850,00 S-EUR et 53 760,85 U-USD ne s'additionnent ni ne se comparent sans taux daté. Le titulaire de l'adresse et le client crédité chez PorteY ne sont pas documentés : c'est une frontière de connaissance.",
      exercise: {
        id: "ex-parcours",
        kind: "qualification",
        prompt: "Qui a reçu les 49 850,00 S-EUR envoyés par PorteX ?",
        options: [
          { id: "a", label: "Lumen Studio, puisque la facture la désigne.", verdict: "faux", feedback: "La facture désigne un bénéficiaire ; elle ne prouve pas qui détient l'adresse payée." },
          { id: "b", label: "PorteY, puisque les fonds y ont été déposés ensuite.", verdict: "faux", feedback: "Le dépôt sur une adresse de PorteY montre où les U-USD sont allés après l'échange, pas qui détenait l'adresse 0xFICTIF…D3ST." },
          { id: "c", label: "Informations insuffisantes : aucune pièce n'attribue l'adresse 0xFICTIF…D3ST à une personne.", verdict: "juste", feedback: "Oui : c'est une frontière de connaissance. On la note, on ne la comble pas par déduction." },
          { id: "d", label: "Un client de PorteY, que PorteY peut donc identifier sans difficulté.", verdict: "partiel", feedback: "Le dépôt laisse penser que le titulaire a un compte chez PorteY, mais la référence de dépôt n'est pas sur la chaîne : seule une pièce de PorteY, obtenue dans un cadre légal, le dirait." },
        ],
      },
    },
    {
      id: "signal",
      marker: "Signal",
      title: "La discordance",
      question: "Que pouvez-vous affirmer à partir de l'instruction de paiement ?",
      asOf: "2026-09-18",
      reveals: ["p-instruction"],
      explanation:
        "Le fait précis : l'adresse payée et le bénéficiaire de l'instruction (« Lumen Studio c/o Kappa Payments ») diffèrent du contrat et de la facture, et aucun écrit signé n'accompagne le changement, alors que le contrat l'exige. C'est un signal à vérifier. Ni le vol ni le blanchiment ne sont établis à ce stade.",
      exercise: {
        id: "ex-signal",
        kind: "qualification",
        prompt: "L'adresse payée et le bénéficiaire de l'instruction diffèrent du contrat. Quelle formulation est la plus juste ?",
        options: [
          { id: "a", label: "Les coordonnées payées diffèrent du contrat, sans l'écrit signé prévu : c'est un fait précis, à vérifier.", verdict: "juste", feedback: "Oui : on énonce le fait et sa limite, sans qualifier encore la cause." },
          { id: "b", label: "C'est un blanchiment : les fonds ont été échangés puis déposés sur une plateforme hors de l'Union européenne.", verdict: "faux", feedback: "Un échange et un dépôt sont des opérations courantes. Ni l'origine illicite ni l'intention ne sont établies." },
          { id: "c", label: "Nova a été victime d'une fraude.", verdict: "faux", feedback: "C'est une hypothèse. Un mandat légitime ou une erreur documentaire expliqueraient aussi la discordance." },
          { id: "d", label: "Informations insuffisantes : on ne peut rien affirmer.", verdict: "partiel", feedback: "La cause est inconnue, mais la discordance elle-même est établie par les pièces." },
        ],
      },
    },
    {
      id: "hypotheses",
      marker: "Hypothèses",
      title: "Formuler des hypothèses",
      question: "Quelles explications sont possibles ?",
      raises: ["c-hyp-mandat", "c-hyp-erreur", "c-hyp-substitution"],
      explanation:
        "Trois explications restent ouvertes : un mandat légitime, une erreur documentaire, une substitution de coordonnées par un tiers. Le jeton, l'échange ou l'établissement de PorteY n'en désignent aucune.",
      exercise: {
        id: "ex-hypotheses",
        kind: "hypotheses",
        multiple: true,
        minSelected: 2,
        prompt: "Retenez au moins deux hypothèses à vérifier, dont une explication licite.",
        requireOneOf: {
          optionIds: ["h1", "h2"],
          hint: "La consigne demande une explication licite : un mandat donné par Lumen ou une erreur documentaire.",
        },
        options: [
          { id: "h1", label: "Lumen a mandaté Kappa Payments et changé d'adresse légitimement.", verdict: "juste", feedback: "Explication licite, à vérifier avec le mandat et une confirmation indépendante." },
          { id: "h2", label: "L'instruction contient une erreur documentaire.", verdict: "juste", feedback: "Explication licite, à vérifier auprès de Lumen." },
          { id: "h3", label: "Un tiers a substitué les coordonnées de paiement de Lumen.", verdict: "juste", feedback: "Hypothèse de fraude au changement de coordonnées, à vérifier ; ce n'est pas une conclusion." },
          { id: "h4", label: "L'usage d'un jeton stable montre que Nova voulait dissimuler le paiement.", verdict: "faux", feedback: "Le contrat prévoit ce mode de paiement ; rien ne suggère une dissimulation par Nova." },
          { id: "h5", label: "Le dépôt sur une plateforme hors de l'Union européenne prouve un blanchiment.", verdict: "faux", feedback: "Ni l'établissement d'une plateforme ni un dépôt ne prouvent un blanchiment." },
        ],
      },
    },
    {
      id: "verifications",
      marker: "Vérifications",
      title: "Choisir les vérifications",
      question: "Quelles vérifications mener en priorité ?",
      explanation:
        "Les vérifications utiles sont disponibles et proportionnées : confirmer auprès de Lumen par un canal indépendant, obtenir le mandat, faire attribuer l'adresse par son titulaire, et obtenir un justificatif de crédit. L'absence d'identité publique d'une adresse ne prouve rien ; une recherche en ligne ne remplace pas une pièce.",
      exercise: {
        id: "ex-verifications",
        kind: "verifications",
        multiple: true,
        minSelected: 1,
        maxSelected: 3,
        prompt: "Choisissez jusqu'à trois vérifications.",
        options: [
          { id: "v1", label: "Confirmer l'instruction auprès de Lumen par un canal indépendant (contact du contrat, pas le courriel reçu)", verdict: "juste", feedback: "La vérification la plus directe d'un changement de coordonnées." },
          { id: "v2", label: "Obtenir le mandat liant Lumen à Kappa Payments", verdict: "juste", feedback: "Établit ou écarte l'explication licite." },
          { id: "v3", label: "Obtenir une attestation du titulaire de l'adresse 0xFICTIF…D3ST et un justificatif de crédit de Lumen", verdict: "juste", feedback: "Attribution et sortie bancaire se prouvent par des pièces, pas par la chaîne." },
          { id: "v4", label: "Chercher en ligne qui détient l'adresse 0xFICTIF…D3ST", verdict: "faux", feedback: "Une attribution trouvée en ligne est au mieux une inférence ; ce n'est pas une pièce." },
          { id: "v5", label: "Bloquer tout paiement futur vers un prestataire établi hors de l'Union européenne", verdict: "faux", feedback: "Disproportionné, et sans lien avec la question posée." },
        ],
      },
    },
  ],
  branches: [
    {
      id: "branche-a",
      label: "Branche A : le mandat est valide",
      asOf: "2026-09-22",
      reveals: ["p-appel-a", "p-mandat", "p-attestation-kappa", "p-releve-b"],
      resolves: [
        { claimId: "c-hyp-mandat", outcome: "confirmee", byClaimId: "c-confirmation" },
        { claimId: "c-hyp-substitution", outcome: "infirmee", byClaimId: "c-confirmation" },
        { claimId: "c-dest-inconnue", outcome: "renseignee", byClaimId: "c-attestation-kappa" },
        { claimId: "c-sortie-inconnue", outcome: "renseignee", byClaimId: "c-releve-b" },
        { claimId: "c-instruction-dit", outcome: "confirmee", byClaimId: "c-mandat" },
      ],
      levels: [
        { level: "signal_faible", statement: "Le changement d'adresse et de bénéficiaire juste avant l'échéance était un signal faible ; le mandat l'explique.", claimIds: ["c-discordance", "c-mandat"] },
        { level: "facteur_risque", statement: "Une instruction reçue par courriel, sans l'écrit signé prévu au contrat, reste une vulnérabilité de la procédure de Nova.", claimIds: ["c-instruction-recue", "c-contrat"] },
        { level: "faisceau", statement: "Aucun faisceau : les pièces convergent vers une opération autorisée.", claimIds: [] },
        { level: "preuve", statement: "La confirmation de Lumen, le mandat et l'avis de crédit établissent que Lumen a été payée par son mandataire.", claimIds: ["c-confirmation", "c-mandat", "c-releve-b"] },
      ],
      conclusion:
        "Lumen a mandaté Kappa Payments, qui détient l'adresse payée, gère sa trésorerie en U-USD chez PorteY et a reversé 49 600,75 € à Lumen. L'écart avec les 49 850,00 € facturés correspond aux 0,5 % de frais du mandat. Ce montant se lit sur la pièce bancaire : il ne se déduit pas des montants sur la chaîne.",
      openQuestions: [
        "Le statut de Kappa Payments comme prestataire de services sur cryptoactifs reste à vérifier dans le registre, à la date de l'opération.",
        "L'écrit signé prévu au contrat manque toujours : il doit être régularisé.",
      ],
      recommendations: [
        "Confirmer tout changement de coordonnées par un canal indépendant avant de payer.",
        "Conserver le mandat, l'attestation et l'avis de crédit au dossier.",
      ],
      exercise: {
        id: "ex-branche-a",
        kind: "conclusion",
        prompt: "Avec ces pièces, quelle conclusion retenez-vous ?",
        options: [
          { id: "a", label: "Paiement autorisé et reçu par Lumen via son mandataire ; la procédure de changement de coordonnées reste à corriger.", verdict: "juste", feedback: "Oui : le signal est levé par des pièces, la vulnérabilité de procédure demeure." },
          { id: "b", label: "Les 49 600,75 € reçus prouvent que 249,25 € ont été détournés.", verdict: "faux", feedback: "Le mandat prévoit 0,5 % de frais : 249,25 €. L'écart est expliqué par une pièce." },
          { id: "c", label: "L'échange en U-USD et le dépôt chez PorteY restent suspects malgré tout.", verdict: "faux", feedback: "L'attestation de Kappa explique ces opérations de trésorerie ; sans autre élément, elles ne sont pas un indice." },
        ],
      },
    },
    {
      id: "branche-b",
      label: "Branche B : la substitution n'était pas autorisée",
      asOf: "2026-09-22",
      reveals: ["p-appel-b", "p-entetes", "p-transfert-portex"],
      resolves: [
        { claimId: "c-hyp-substitution", outcome: "confirmee", byClaimId: "c-dementi" },
        { claimId: "c-hyp-mandat", outcome: "infirmee", byClaimId: "c-dementi" },
        { claimId: "c-hyp-erreur", outcome: "infirmee", byClaimId: "c-domaine" },
        { claimId: "c-instruction-dit", outcome: "infirmee", byClaimId: "c-dementi" },
      ],
      boundary:
        "Les fonds s'arrêtent, pour ce dossier, à l'adresse de dépôt de PorteY. Qui a été crédité, et si les U-USD ont été vendus, seule une pièce obtenue dans un cadre légal pourrait le dire.",
      levels: [
        { level: "signal_faible", statement: "Le changement d'adresse et de bénéficiaire juste avant l'échéance était un signal faible.", claimIds: ["c-discordance"] },
        { level: "facteur_risque", statement: "Une instruction reçue par courriel, sans l'écrit signé prévu, a permis la substitution.", claimIds: ["c-instruction-recue", "c-contrat"] },
        { level: "faisceau", statement: "Absence d'écrit signé, domaine d'expéditeur différent et récent, démenti de Lumen : les éléments convergent.", claimIds: ["c-instruction-recue", "c-domaine", "c-dementi"] },
        { level: "preuve", statement: "Le démenti de Lumen et l'en-tête établissent une substitution non autorisée des coordonnées. Ils ne prouvent ni l'auteur, ni un blanchiment, ni le devenir des fonds après le dépôt chez PorteY.", claimIds: ["c-dementi", "c-domaine"] },
      ],
      conclusion:
        "Une fraude au changement de coordonnées de paiement est établie : Lumen n'a pas émis l'instruction et le courriel vient d'un domaine imitant le sien. Nova a payé une adresse inconnue ; Lumen n'est pas payée. Le nom de Kappa Payments a pu être usurpé. La suite du parcours des fonds reste inconnue.",
      openQuestions: [
        "Qui contrôle l'adresse 0xFICTIF…D3ST ?",
        "Kappa Payments existe-t-elle, ou son nom a-t-il été usurpé ?",
        "Les U-USD déposés chez PorteY ont-ils été vendus, et au profit de qui ? Une fraude au paiement ne prouve pas à elle seule un blanchiment ultérieur.",
      ],
      recommendations: [
        "Prévenir sans délai PorteX et la banque A, et porter plainte en conservant toutes les pièces.",
        "Laisser aux autorités compétentes les demandes auprès de PorteY ; ne pas chercher soi-même à identifier le titulaire de l'adresse.",
        "Exiger une confirmation par un canal indépendant avant tout changement de coordonnées.",
      ],
      exercise: {
        id: "ex-branche-b",
        kind: "conclusion",
        prompt: "Avec ces pièces, quelle conclusion retenez-vous ?",
        options: [
          { id: "a", label: "Une substitution non autorisée des coordonnées est établie ; l'auteur et le devenir des fonds après PorteY restent inconnus.", verdict: "juste", feedback: "Oui : un fait précis est documenté, et la frontière de connaissance est assumée." },
          { id: "b", label: "Kappa Payments est l'auteur de la fraude.", verdict: "faux", feedback: "Son nom figure dans le courriel frauduleux ; il a pu être usurpé. Rien n'établit son rôle." },
          { id: "c", label: "La fraude prouve aussi un blanchiment chez PorteY.", verdict: "faux", feedback: "Une fraude au paiement documentée ne prouve pas à elle seule un blanchiment ultérieur." },
          { id: "d", label: "Informations insuffisantes pour conclure quoi que ce soit.", verdict: "partiel", feedback: "Le devenir des fonds est inconnu, mais la substitution est établie par le démenti et l'en-tête." },
        ],
      },
    },
  ],
};

/** Scénario validé au chargement : une incohérence casse le build et les tests. */
export const NOVA_SCENARIO = Scenario.parse(nova);
