/**
 * Couche d'analyse transactionnelle (Lot D — périmètre flux RÉOUVERT).
 *
 * Opère sur des transactions IMPORTÉES (données client) ou des jeux SYNTHÉTIQUES
 * documentés — jamais une donnée d'échantillon présentée comme réelle. Pure et
 * déterministe (« compute first ») : statistiques explicables, aucune inférence
 * LLM. La matérialisation en graphe (arête `flux`, anneaux de fraude) est
 * volontairement DIFFÉRÉE tant que la représentation des flux n'est pas tranchée.
 */
export type Transaction = {
  id: string;
  /** Date ISO (YYYY-MM-DD) ou horodatage. Optionnel pour les détecteurs de montant. */
  date?: string;
  /** Montant signé (négatif = débit). Les détecteurs travaillent sur |montant|. */
  amount: number;
  currency?: string;
  /** Contrepartie (nom normalisable) — clé de regroupement des doublons. */
  counterparty?: string;
  label?: string;
};
