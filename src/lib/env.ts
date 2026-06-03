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
  TRESOR_GELS_ENABLED: z.enum(["true", "false"]).default("false"),
  TRESOR_GELS_BASE_URL: z.string().default("https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1"),
  OPENSANCTIONS_API_KEY: z.string().optional(),
  OPENSANCTIONS_BASE_URL: z.string().default("https://api.opensanctions.org"),
  OPENSANCTIONS_DATASET: z.string().default("sanctions"),
});

export const env = serverSchema.parse(process.env);

/** Mode démo : actif tant que NEXT_PUBLIC_DEMO_MODE n'est pas explicitement 'false'. */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
}

export const hasSireneKey = (): boolean => Boolean(env.INSEE_SIRENE_API_KEY);
export const isTresorGelsEnabled = (): boolean => env.TRESOR_GELS_ENABLED === "true";
export const hasOpenSanctionsKey = (): boolean =>
  Boolean(env.OPENSANCTIONS_API_KEY);
