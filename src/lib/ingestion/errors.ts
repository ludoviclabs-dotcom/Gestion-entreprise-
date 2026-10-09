import type { SourceKind } from "@/lib/graph/source";

/**
 * Source INDISPENSABLE à un dossier réel indisponible (clé absente, accès refusé,
 * SIREN inconnu). Le message est destiné à l'utilisateur : en français, sans
 * secret ni URL. Permet à l'action de création de répondre proprement au lieu de
 * fabriquer un dossier à partir d'une fixture d'échantillon.
 */
export class SourceError extends Error {
  constructor(
    public readonly source: SourceKind,
    message: string,
  ) {
    super(message);
    this.name = "SourceError";
  }
}
