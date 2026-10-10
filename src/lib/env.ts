import { z } from "zod";

/**
 * Validation des variables d'environnement côté serveur.
 * Toutes optionnelles ou avec défaut : l'app boote en mode démo sans aucune clé.
 * Ne pas importer ce module depuis un composant client (clés serveur uniquement).
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  INSEE_SIRENE_API_KEY: z.string().optional(),
  INSEE_SIRENE_BASE_URL: z.string().default("https://api.insee.fr/api-sirene/3.11"),
  BODACC_BASE_URL: z.string().default("https://bodacc-datadila.opendatasoft.com/api/explore/v2.1"),
  BODACC_API_KEY: z.string().optional(),
  INPI_USERNAME: z.string().optional(),
  INPI_PASSWORD: z.string().optional(),
  INPI_BASE_URL: z
    .string()
    .default("https://registre-national-entreprises.inpi.fr/api"),
  // Garde-fou CJUE 22/11/2022 (C-37/20 & C-601/20) : l'accès aux bénéficiaires
  // effectifs est conditionné à un intérêt légitime + log d'audit (Étape 2.2
  // auth + 3.4 audit_logs). Tant que ce dispositif n'est pas en place, les UBO
  // récupérés via INPI ne sont PAS rendus dans le graphe. Ne passer à "true"
  // qu'une fois l'auth + le log d'intérêt légitime opérationnels.
  INPI_EXPOSE_UBO: z.enum(["true", "false"]).default("false"),
  TRESOR_GELS_ENABLED: z.enum(["true", "false"]).default("false"),
  TRESOR_GELS_BASE_URL: z.string().default("https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1"),
  OPENSANCTIONS_API_KEY: z.string().optional(),
  OPENSANCTIONS_BASE_URL: z.string().default("https://api.opensanctions.org"),
  OPENSANCTIONS_DATASET: z.string().default("sanctions"),
  // GLEIF — référentiel LEI ouvert (CC0, sans clé). Opt-in explicite (comme
  // TRESOR_GELS) : activer pour récupérer les sociétés mères transfrontalières.
  GLEIF_ENABLED: z.enum(["true", "false"]).default("false"),
  GLEIF_BASE_URL: z.string().default("https://api.gleif.org/api/v1"),
  // VIES — validation TVA intracommunautaire (Commission UE, sans clé). Opt-in.
  VIES_ENABLED: z.enum(["true", "false"]).default("false"),
  VIES_BASE_URL: z
    .string()
    .default("https://ec.europa.eu/taxation_customs/vies/rest-api"),
  // BAN — Base Adresse Nationale (géocodage/normalisation, sans clé). Opt-in.
  BAN_ENABLED: z.enum(["true", "false"]).default("false"),
  BAN_BASE_URL: z.string().default("https://api-adresse.data.gouv.fr"),
  // GDELT — presse / adverse media (API DOC 2.0 ouverte, sans clé). Opt-in.
  GDELT_ENABLED: z.enum(["true", "false"]).default("false"),
  GDELT_BASE_URL: z.string().default("https://api.gdeltproject.org/api/v2"),
  // Pappers — agrégateur commercial (identité + dirigeants + bilans financiers).
  // Plan gratuit : 2 000 appels/mois. Opt-in clé API.
  PAPPERS_ENABLED: z.enum(["true", "false"]).default("false"),
  PAPPERS_API_KEY: z.string().optional(),
  PAPPERS_BASE_URL: z.string().default("https://api.pappers.fr/v2"),
  // Companies House (Royaume-Uni) — registre officiel gratuit : dirigeants et
  // personnes à contrôle significatif des SOCIÉTÉS MÈRES britanniques repérées par
  // GLEIF (second saut). Opt-in : flag ET clé API (auth HTTP Basic, clé en login).
  COMPANIES_HOUSE_ENABLED: z.enum(["true", "false"]).default("false"),
  COMPANIES_HOUSE_API_KEY: z.string().optional(),
  COMPANIES_HOUSE_BASE_URL: z
    .string()
    .default("https://api.company-information.service.gov.uk"),
  // Recherche d'entreprises (DINUM / annuaire-entreprises) — API ouverte, SANS clé :
  // dirigeants (issus du RNE), derniers comptes, labels publics. 7 req/s/IP. Opt-in.
  RECHERCHE_ENTREPRISES_ENABLED: z.enum(["true", "false"]).default("false"),
  RECHERCHE_ENTREPRISES_BASE_URL: z
    .string()
    .default("https://recherche-entreprises.api.gouv.fr"),
  // Lot « DILA » — jeux de données ouverts (Opendatasoft), SANS clé ni compte.
  // Chacun est opt-in (false par défaut) et indépendant des autres.
  BALO_ENABLED: z.enum(["true", "false"]).default("false"),
  BOAMP_ENABLED: z.enum(["true", "false"]).default("false"),
  JOAFE_ENABLED: z.enum(["true", "false"]).default("false"),
  DCA_ENABLED: z.enum(["true", "false"]).default("false"),
  DILA_JO_BASE_URL: z
    .string()
    .default("https://journal-officiel-datadila.opendatasoft.com"),
  BOAMP_BASE_URL: z.string().default("https://boamp-datadila.opendatasoft.com"),
  // Lot « labels » — RGE (ADEME), Agence BIO, Alim'confiance (DGAL), Qualiopi
  // (DGEFP) : jeux ouverts, SANS clé. Opt-in ; interrogés seulement quand
  // « Recherche d'entreprises » signale le label (donc après elle).
  RGE_ENABLED: z.enum(["true", "false"]).default("false"),
  AGENCE_BIO_ENABLED: z.enum(["true", "false"]).default("false"),
  ALIM_CONFIANCE_ENABLED: z.enum(["true", "false"]).default("false"),
  QUALIOPI_ENABLED: z.enum(["true", "false"]).default("false"),
  // Lot « réglementaire » — Géorisques (ICPE, par SIRET) et Annuaire de
  // l'administration (personnes morales de droit public) : SANS clé, opt-in.
  ICPE_IMPORT_ENABLED: z.enum(["true", "false"]).default("false"),
  CAMINO_ENABLED: z.enum(["true", "false"]).default("false"),
  GEORISQUES_ENABLED: z.enum(["true", "false"]).default("false"),
  ANNUAIRE_ADMINISTRATION_ENABLED: z.enum(["true", "false"]).default("false"),
  GEORISQUES_BASE_URL: z.string().default("https://www.georisques.gouv.fr"),
  ANNUAIRE_BASE_URL: z
    .string()
    .default("https://api-lannuaire.service-public.fr"),
  ADEME_BASE_URL: z.string().default("https://data.ademe.fr"),
  AGENCE_BIO_BASE_URL: z.string().default("https://opendata.agencebio.org"),
  DGAL_BASE_URL: z.string().default("https://dgal.opendatasoft.com"),
  DGEFP_BASE_URL: z.string().default("https://dgefp.opendatasoft.com"),
  // Résolution d'entités : `builtin` (TS in-process, défaut) ou `splink`
  // (sidecar Python probabiliste, à raccorder). Cf. resolver-backend.ts.
  RESOLVER_BACKEND: z.enum(["builtin", "splink"]).default("builtin"),
  SPLINK_BASE_URL: z.string().optional(),
  // Gate optionnelle des routes d'export (même esprit que CRON_SECRET) :
  // si défini, les exports exigent ?token=<valeur>. Non défini → public
  // (garde-fou « mode démo zéro-clé » intact). L'auth utilisateur réelle
  // arrive à l'Étape 2.2 (Better-Auth).
  EXPORT_TOKEN: z.string().optional(),
});

export const env = serverSchema.parse(process.env);

/** Mode démo : actif tant que NEXT_PUBLIC_DEMO_MODE n'est pas explicitement 'false'. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
}

export const hasSireneKey = (): boolean => Boolean(env.INSEE_SIRENE_API_KEY);
export const isTresorGelsEnabled = (): boolean => env.TRESOR_GELS_ENABLED === "true";
export const isGleifEnabled = (): boolean => env.GLEIF_ENABLED === "true";
export const isViesEnabled = (): boolean => env.VIES_ENABLED === "true";
export const isBanEnabled = (): boolean => env.BAN_ENABLED === "true";
export const isGdeltEnabled = (): boolean => env.GDELT_ENABLED === "true";
export const isPappersEnabled = (): boolean =>
  env.PAPPERS_ENABLED === "true" && Boolean(env.PAPPERS_API_KEY);
export const isBaloEnabled = (): boolean => env.BALO_ENABLED === "true";
export const isBoampEnabled = (): boolean => env.BOAMP_ENABLED === "true";
export const isJoafeEnabled = (): boolean => env.JOAFE_ENABLED === "true";
export const isDcaEnabled = (): boolean => env.DCA_ENABLED === "true";
export const isRgeEnabled = (): boolean => env.RGE_ENABLED === "true";
export const isAgenceBioEnabled = (): boolean => env.AGENCE_BIO_ENABLED === "true";
export const isAlimConfianceEnabled = (): boolean =>
  env.ALIM_CONFIANCE_ENABLED === "true";
export const isQualiopiEnabled = (): boolean => env.QUALIOPI_ENABLED === "true";
export const isIcpeImportEnabled = (): boolean => env.ICPE_IMPORT_ENABLED === "true";
export const isCaminoEnabled = (): boolean => env.CAMINO_ENABLED === "true";
export const isGeorisquesEnabled = (): boolean => env.GEORISQUES_ENABLED === "true";
export const isAnnuaireAdministrationEnabled = (): boolean =>
  env.ANNUAIRE_ADMINISTRATION_ENABLED === "true";
export const isRechercheEntreprisesEnabled = (): boolean =>
  env.RECHERCHE_ENTREPRISES_ENABLED === "true";
export const isCompaniesHouseEnabled = (): boolean =>
  env.COMPANIES_HOUSE_ENABLED === "true" && Boolean(env.COMPANIES_HOUSE_API_KEY);
export const hasOpenSanctionsKey = (): boolean =>
  Boolean(env.OPENSANCTIONS_API_KEY);
export const hasInpiCreds = (): boolean =>
  Boolean(env.INPI_USERNAME && env.INPI_PASSWORD);
/** Garde-fou CJUE : affichage des UBO réels uniquement si explicitement activé. */
export const isInpiUboExposed = (): boolean => env.INPI_EXPOSE_UBO === "true";
