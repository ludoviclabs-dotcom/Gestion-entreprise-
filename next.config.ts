import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactCompiler: true,
};

const composedConfig = bundleAnalyzer(nextConfig);

// Le wrap Sentry câble :
// - L'auto-instrumentation du runtime Node + Edge
// - L'upload des source maps en build (no-op si SENTRY_AUTH_TOKEN absent)
// - La capture des erreurs des Server Actions + RSC
// Sans clé Sentry (SENTRY_DSN absent), le wrap reste un no-op et l'app boote
// normalement en mode démo.
export default withSentryConfig(composedConfig, {
  // Désactive le silent mode pour voir les logs Sentry au build (utile pour debug).
  silent: false,
  // Désactive l'upload de source maps (pas de SENTRY_AUTH_TOKEN posé).
  sourcemaps: {
    disable: true,
  },
  // Désactive le tunnel (utile uniquement si tu veux router les events via /monitoring
  // pour bypasser des adblockers — pas nécessaire pour un endpoint serveur).
  tunnelRoute: undefined,
  // Évite les warnings sur les routes API qui throw.
  disableLogger: false,
});
