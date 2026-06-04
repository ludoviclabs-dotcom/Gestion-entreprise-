import {
  env,
  isDemoMode,
  hasSireneKey,
  isTresorGelsEnabled,
  hasOpenSanctionsKey,
  hasInpiCreds,
  isInpiUboExposed,
} from "@/lib/env";

/**
 * Source de vérité unique du statut live/démo de chaque connecteur.
 * Miroir exact du `shouldMock()` de chaque connecteur (cf. sirene.ts,
 * bodacc.ts, inpi.ts, tresor-gels.ts, opensanctions.ts) afin que la page
 * Réglages reflète FIDÈLEMENT ce que l'app interroge réellement.
 *
 * ⚠️ SERVER-ONLY : lit `env` (présence de clés serveur). Ne jamais importer
 * depuis un composant client.
 */
export type ConnectorStatus = {
  key: string;
  label: string;
  live: boolean;
  detail: string;
};

export function getConnectorStatuses(): ConnectorStatus[] {
  const demo = isDemoMode();
  return [
    {
      key: "sirene",
      label: "INSEE Sirene",
      live: !demo && hasSireneKey(),
      detail:
        !demo && hasSireneKey()
          ? "Identité légale + établissement siège en temps réel."
          : hasSireneKey()
            ? "Clé posée — actif dès la sortie du mode démo."
            : "Clé INSEE_SIRENE_API_KEY non posée → fixture.",
    },
    {
      key: "bodacc",
      label: "BODACC",
      live: !demo,
      detail: !demo
        ? env.BODACC_API_KEY
          ? "Annonces légales en temps réel (quota élevé)."
          : "Annonces légales en temps réel (quota anonyme)."
        : "Mode démo → fixture.",
    },
    {
      key: "tresor",
      label: "DG Trésor — gels",
      live: !demo && isTresorGelsEnabled(),
      detail:
        !demo && isTresorGelsEnabled()
          ? "Registre national des gels d'avoirs en temps réel."
          : isTresorGelsEnabled()
            ? "Flag actif — actif dès la sortie du mode démo."
            : "TRESOR_GELS_ENABLED non activé → fixture.",
    },
    {
      key: "opensanctions",
      label: "OpenSanctions",
      live: !demo && hasOpenSanctionsKey(),
      detail:
        !demo && hasOpenSanctionsKey()
          ? "Sanctions + PEP (agrégat UE) en temps réel."
          : hasOpenSanctionsKey()
            ? "Clé posée — actif dès la sortie du mode démo."
            : "OPENSANCTIONS_API_KEY non posée → fixture.",
    },
    {
      key: "inpi",
      label: "INPI / RNE",
      live: !demo && hasInpiCreds(),
      detail:
        !demo && hasInpiCreds()
          ? isInpiUboExposed()
            ? "Dirigeants + bénéficiaires effectifs en temps réel."
            : "Dirigeants en temps réel (UBO masqués — garde-fou CJUE)."
          : "Credentials INPI non posés → fixture.",
    },
    {
      key: "database",
      label: "Base de données (Neon)",
      live: Boolean(env.DATABASE_URL),
      detail: env.DATABASE_URL
        ? "Persistance Postgres connectée."
        : "Aucune base → store en mémoire (volatil).",
    },
  ];
}

/** Mode global : true si l'app interroge les API réelles. */
export const isLiveMode = (): boolean => !isDemoMode();
