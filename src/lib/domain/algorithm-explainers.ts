/**
 * Explainers « ce que ça prouve / sa limite » pour les algorithmes de graphe
 * déjà implémentés. Sert le surfaçage in-produit (composant AlgorithmExplainer)
 * dans les onglets analyse / risques / graphe.
 *
 * Posture méthodologique : chaque algorithme produit un SIGNAL à qualifier,
 * jamais une conclusion. Aucun vocabulaire accusatoire (cf. tests unitaires).
 */

export type AlgorithmExplainerEntry = {
  /** Identifiant stable (clé de wiring). */
  id: string;
  title: string;
  /** Fonction source dans le code (traçabilité « model card »). */
  fn: string;
  /** Ce que l'algorithme établit. */
  proves: string;
  /** Sa limite explicite — ce qu'il n'établit pas. */
  limit: string;
};

export const ALGORITHM_EXPLAINERS = {
  "detention-indirecte": {
    id: "detention-indirecte",
    title: "Détention indirecte & dilution",
    fn: "computeUbo — src/lib/graph/ubo.ts",
    proves:
      "Multiplie les participations le long de chaque chaîne et somme les chemins parallèles, séparément pour le capital et les droits de vote. Applique le référentiel en vigueur à la date d'analyse : plus de 25 % en droit français actuel (CMF R. 561-1), 25 % ou plus sous l'AMLR à partir du 10 juillet 2027. Le contrôle majoritaire exige strictement plus de 50 % des votes à chaque étage.",
    limit:
      "Reflète les participations disponibles : une chaîne incomplète, un pourcentage absent ou un lien inféré produit une limite affichée ou un résultat « à examiner », jamais une certitude. Le contrôle par pacte ou droits de nomination ne se déduit pas du graphe.",
  },
  "ecart-ubo": {
    id: "ecart-ubo",
    title: "UBO recalculé vs déclaré",
    fn: "compareDeclaredUbo — src/lib/graph/ubo.ts",
    proves:
      "Compare le nombre de bénéficiaires effectifs recalculés depuis le graphe au nombre déclaré au registre. Renvoie des comptes seuls, sans données nominatives (garde-fou CJUE).",
    limit:
      "Une divergence peut résulter d'un décalage de mise à jour du registre, pas nécessairement d'une dissimulation : à qualifier humainement.",
  },
  boucles: {
    id: "boucles",
    title: "Détection de boucles de détention",
    fn: "stronglyConnectedComponents — src/lib/graph/algorithms.ts",
    proves:
      "Repère les composantes fortement connexes (≥ 2 entités) où une entité se détient indirectement elle-même — un signal d'opacité structurelle.",
    limit:
      "Une boucle peut être un artefact de données ou une structure licite ; sa présence appelle une revue, pas une conclusion.",
  },
  centralite: {
    id: "centralite",
    title: "Centralité d'intermédiarité (betweenness)",
    fn: "computeGraphMetrics — src/lib/graph/algorithms.ts",
    proves:
      "Mesure les nœuds « pivots » par lesquels passent le plus de chemins : adresses partagées, dirigeants multi-mandats, hubs de structuration.",
    limit:
      "Une centralité élevée signale un point d'attention, pas une irrégularité : un domiciliataire légitime peut être très central.",
  },
  "chemin-sanctions": {
    id: "chemin-sanctions",
    title: "Plus court chemin vers une entité sous sanction",
    fn: "shortestEvidenceWeightedPath — src/lib/graph/algorithms.ts",
    proves:
      "Trouve le chemin le plus court vers une entité figurant sur une liste de gels/sanctions, pondéré par le niveau de preuve de chaque lien (un lien confirmé pèse moins « cher » qu'un lien inféré).",
    limit:
      "Un chemin de proximité n'établit pas une relation juridique ; les homonymies exigent une revue des identifiants (date de naissance, références UE/ONU), pas seulement du nom.",
  },
} as const satisfies Record<string, AlgorithmExplainerEntry>;

export type AlgorithmId = keyof typeof ALGORITHM_EXPLAINERS;
