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
      "Multiplie les participations le long de chaque chaîne et somme les chemins parallèles pour obtenir le pourcentage effectif. Identifie les bénéficiaires effectifs au seuil de 25 % ou en contrôle majoritaire.",
    limit:
      "Reflète les participations déclarées disponibles : une chaîne incomplète ou non documentée peut sous-estimer la détention réelle.",
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
  "resolution-entites": {
    id: "resolution-entites",
    title: "Résolution d'entités",
    fn: "resolveEntities — src/lib/ingestion/entity-resolver.ts",
    proves:
      "Rapproche les entités issues de plusieurs sources par similarité de nom (Jaro-Winkler + clé phonétique) : sociétés par SIREN puis dénomination, personnes par nom complet. Les variantes (« Jean Martin » / « J. Martin », « DUPONT SARL » / « Dupont S.A.R.L. ») fusionnent en une entité canonique, et les liens sont re-pointés.",
    limit:
      "Un rapprochement nominatif n'établit pas une identité juridique : les homonymies imposent une revue sur les identifiants (SIREN, date de naissance). Le seuil de fusion est volontairement conservateur ; deux SIREN distincts ne sont jamais fusionnés.",
  },
} as const satisfies Record<string, AlgorithmExplainerEntry>;

export type AlgorithmId = keyof typeof ALGORITHM_EXPLAINERS;
