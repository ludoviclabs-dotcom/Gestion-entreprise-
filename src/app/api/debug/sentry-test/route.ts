/**
 * Route temporaire de validation Sentry — à SUPPRIMER après le test du tutoriel (étape 10).
 * Cf. docs/tutorial-connecteurs.md — section vérification Sentry.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  throw new Error(
    "Sentry debug throw — validation tutoriel étape 10. Si cette erreur apparaît dans Sentry, la chaîne Vercel → SENTRY_DSN → Sentry EU fonctionne.",
  );
}
