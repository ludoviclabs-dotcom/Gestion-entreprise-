import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

// drizzle-kit ne charge pas automatiquement .env.local (contrairement à Next).
// loadEnvConfig est fourni par @next/env (dépendance de Next.js, déjà installé)
// et applique le même ordre de chargement que `next dev` : .env.local > .env.
loadEnvConfig(process.cwd());

// Pour les migrations + transactions, on préfère l'URL directe (non-poolée)
// quand elle existe. Sinon on retombe sur l'URL standard.
const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
