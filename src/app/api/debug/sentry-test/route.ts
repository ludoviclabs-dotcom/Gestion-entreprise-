/**
 * Route temporaire de DIAGNOSTIC Sentry — à SUPPRIMER après l'étape 10.
 * Ne throw plus : renvoie un JSON qui dit exactement où la chaîne casse.
 *   - hasClient=false  → Sentry.init() n'a jamais tourné (instrumentation/Turbopack)
 *   - hasClient=true + eventId présent + rien dans Sentry → DSN faux projet / beforeSend / réseau
 *   - dsnTailRuntime ≠ dsnTailEnv → la valeur posée sur Vercel a un espace / saut de ligne
 */
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const client = Sentry.getClient();
  const runtimeDsn = client?.getOptions().dsn;
  const envDsn = process.env.SENTRY_DSN;

  const eventId = Sentry.captureException(
    new Error("Sentry debug throw — validation tutoriel étape 10"),
  );
  const flushed = await Sentry.flush(3000);

  return Response.json({
    hasClient: Boolean(client),
    eventId: eventId ?? null,
    flushed,
    sentryDsnEnvPresent: Boolean(envDsn),
    dsnTailEnv: typeof envDsn === "string" ? envDsn.trim().slice(-14) : null,
    dsnTailRuntime:
      typeof runtimeDsn === "string" ? runtimeDsn.slice(-14) : null,
    envDsnHasWhitespace:
      typeof envDsn === "string" ? envDsn !== envDsn.trim() : null,
    nextRuntime: process.env.NEXT_RUNTIME ?? null,
  });
}
