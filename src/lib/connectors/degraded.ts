/**
 * Convention de signalement d'une consultation DÉGRADÉE.
 *
 * `source_records` ne porte que (endpoint, http_status, is_fixture). Un connecteur
 * qui échoue au niveau applicatif — exception réseau, erreur HTTP, schéma de
 * réponse non reconnu — suffixe donc l'endpoint enregistré par l'un des marqueurs
 * ci-dessous. Sans cela, une réponse HTTP 200 au contenu inexploitable serait
 * comptée comme une consultation réussie (et un « aucun résultat » comme une
 * absence avérée).
 */
const DEGRADED_SUFFIX =
  /\((?:exception|erreur \d+|schéma non reconnu|délai dépassé|source non importée)\)\s*$/;

export function isDegradedEndpoint(endpoint: string): boolean {
  return DEGRADED_SUFFIX.test(endpoint);
}
