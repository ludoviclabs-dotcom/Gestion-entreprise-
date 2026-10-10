/** Décision lot D : les dates Camino enrichissent le dossier sans effet de score. */
export function isInformationalEvent(event: { kind: string }): boolean {
  return event.kind === "titre_minier_debut" || event.kind === "titre_minier_echeance";
}
