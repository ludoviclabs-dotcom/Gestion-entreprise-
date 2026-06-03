/**
 * Route temporaire de validation Sentry — à SUPPRIMER après le test du tutoriel (étape 10).
 * Capture l'exception explicitement + flush avant throw pour éviter le piège
 * « lambda Vercel gelée avant que le transport Sentry batch l'event ».
 */
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  console.log(
    `[sentry-test] route hit at ${new Date().toISOString()}. SENTRY_DSN present: ${Boolean(process.env.SENTRY_DSN)}`,
  );
  const error = new Error(
    "Sentry debug throw — validation tutoriel étape 10. Si tu vois cette erreur dans Sentry, la chaîne Vercel → SENTRY_DSN → Sentry EU fonctionne.",
  );
  Sentry.captureException(error);
  await Sentry.flush(2000);
  throw error;
}
