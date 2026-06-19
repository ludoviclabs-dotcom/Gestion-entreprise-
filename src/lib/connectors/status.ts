import {
  env,
  isDemoMode,
  hasSireneKey,
  isTresorGelsEnabled,
  hasOpenSanctionsKey,
  hasInpiCreds,
  isInpiUboExposed,
  isGleifEnabled,
  isViesEnabled,
  isBanEnabled,
  isGdeltEnabled,
  isPappersEnabled,
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
      key: "gleif",
      label: "GLEIF / LEI",
      live: !demo && isGleifEnabled(),
      detail:
        !demo && isGleifEnabled()
          ? "Sociétés mères transfrontalières (référentiel LEI)."
          : isGleifEnabled()
            ? "Flag actif — actif dès la sortie du mode démo."
            : "GLEIF_ENABLED non activé → fixture.",
    },
    {
      key: "ban",
      label: "Base Adresse Nationale",
      live: !demo && isBanEnabled(),
      detail:
        !demo && isBanEnabled()
          ? "Normalisation/géocodage des adresses en temps réel."
          : isBanEnabled()
            ? "Flag actif — actif dès la sortie du mode démo."
            : "BAN_ENABLED non activé → fixture.",
    },
    {
      key: "gdelt",
      label: "Presse (GDELT)",
      live: !demo && isGdeltEnabled(),
      detail:
        !demo && isGdeltEnabled()
          ? "Couverture médiatique (adverse media) en temps réel."
          : isGdeltEnabled()
            ? "Flag actif — actif dès la sortie du mode démo."
            : "GDELT_ENABLED non activé → fixture.",
    },
    {
      key: "vies",
      label: "VIES (TVA UE)",
      live: !demo && isViesEnabled(),
      detail:
        !demo && isViesEnabled()
          ? "Validation TVA intracommunautaire en temps réel."
          : isViesEnabled()
            ? "Flag actif — actif dès la sortie du mode démo."
            : "VIES_ENABLED non activé → fixture.",
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
      key: "pappers",
      label: "Pappers",
      live: !demo && isPappersEnabled(),
      detail:
        !demo && isPappersEnabled()
          ? "Identité + bilans financiers en temps réel."
          : isPappersEnabled()
            ? "Flag actif — actif dès la sortie du mode démo."
            : "PAPPERS_API_KEY non posée → fixture.",
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
