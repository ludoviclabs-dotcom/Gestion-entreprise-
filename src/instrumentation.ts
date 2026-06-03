import type { Instrumentation } from "next";

/**
 * Hook d'instrumentation Next.js — exécuté une fois par boot de serveur.
 * DOIT vivre dans src/ (le projet utilise un dossier src/) sinon Next.js
 * ne l'exécute jamais et Sentry.init() ne tire pas.
 * Initialise Sentry côté Node / Edge si SENTRY_DSN est défini. Sans DSN
 * Sentry.init() est un no-op, l'app boote normalement.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  errorContext,
) => {
  if (!process.env.SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(err, request, errorContext);
};
