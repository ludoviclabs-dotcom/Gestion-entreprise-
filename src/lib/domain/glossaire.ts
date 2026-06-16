/**
 * Glossaire institutionnel centralisé — couche terminologique (pattern P5).
 * Source unique des définitions sobres affichées en tooltip sur les termes
 * techniques. Sûr côté client (données pures). Daté pour les notions
 * réglementaires (obsolescence réglementaire, §8).
 *
 * Posture : définir, jamais qualifier. Aucun vocabulaire accusatoire.
 */
export type GlossaryEntry = {
  /** Terme affiché par défaut si aucun enfant n'est fourni. */
  term: string;
  /** Définition courte et factuelle. */
  definition: string;
  /** Référence réglementaire / source, le cas échéant. */
  ref?: string;
};

export const GLOSSARY = {
  ubo: {
    term: "Bénéficiaire effectif",
    definition:
      "Personne physique qui, en dernier ressort, détient ou contrôle une entité — seuil de 25 % de détention ou contrôle équivalent.",
    ref: "Règlement (UE) 2024/1624 (AMLR), applicable au 10/07/2027",
  },
  "detention-effective": {
    term: "Détention effective",
    definition:
      "Pourcentage de capital obtenu en remontant toutes les chaînes de participation : produit des fractions le long de chaque chemin, sommé sur les chemins parallèles.",
  },
  centralite: {
    term: "Centralité d'intermédiarité",
    definition:
      "Mesure de graphe (betweenness) identifiant les nœuds « pivots » par lesquels passe le plus de chemins. Un point d'attention, pas une irrégularité.",
  },
  faisceau: {
    term: "Faisceau d'indices",
    definition:
      "Aucune alerte ne repose sur un signal isolé : la convergence d'au moins deux familles d'indices distinctes (seuil paramétrable) est requise avant toute escalade.",
  },
  "niveau-de-preuve": {
    term: "Niveau de preuve",
    definition:
      "Qualité d'un lien ou d'une donnée : confirmé, déclaré, inféré ou simulé. Un élément inféré ou simulé n'est jamais un fait.",
  },
  pep: {
    term: "PEP",
    definition:
      "Personne politiquement exposée — exerce ou a exercé des fonctions publiques importantes, soumise à une vigilance renforcée.",
    ref: "Dispositif LCB-FT",
  },
  vigilance: {
    term: "Vigilance",
    definition:
      "Score agrégeant les signaux d'attention d'un dossier. Ce n'est pas un score de fraude.",
  },
  complexite: {
    term: "Complexité",
    definition:
      "Score de densité structurelle du réseau (nombre d'entités, degré, densité des liens). Neutre par nature.",
  },
  "qualite-preuve": {
    term: "Qualité de preuve",
    definition:
      "Part des éléments confirmés ou déclarés, par opposition aux éléments inférés ou simulés, dans un dossier.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;
