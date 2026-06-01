import { z, type ZodSchema } from "zod";

/**
 * Wrapper Zod générique pour Server Actions et Route Handlers.
 * Renvoie un Result discriminé pour ne pas masquer les erreurs.
 *
 * Usage :
 *   const parsed = validate(siren, mySchema);
 *   if (!parsed.ok) return { ok: false, error: parsed.error };
 *   const data = parsed.data;
 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function validate<T>(input: unknown, schema: ZodSchema<T>): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Aplatit la première erreur Zod en message FR lisible (l'analyste/utilisateur
    // n'a pas besoin du JSON complet).
    const first = parsed.error.issues[0];
    const path = first.path.length > 0 ? `${first.path.join(".")} : ` : "";
    return { ok: false, error: `${path}${first.message}` };
  }
  return { ok: true, data: parsed.data };
}

/** Schémas réutilisables (SIREN, requête de recherche…). */
export const SirenSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{9}$/, "9 chiffres requis"));

export const SearchQuerySchema = z
  .string()
  .trim()
  .min(1, "Requête vide")
  .max(200, "Requête trop longue (max 200 caractères)");
