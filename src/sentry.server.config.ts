import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  // RGPD : scrubber les payloads sensibles (noms de dirigeants, adresses)
  // avant l'envoi à Sentry SaaS US.
  beforeSend(event) {
    if (event.request?.data && typeof event.request.data === "object") {
      const data = event.request.data as Record<string, unknown>;
      if ("payload" in data) data.payload = "[REDACTED]";
    }
    return event;
  },
});
