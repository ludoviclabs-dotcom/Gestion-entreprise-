import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Singleton paresseux du client Drizzle (driver neon-http, edge-friendly).
 * Lève une erreur uniquement à l'appel si DATABASE_URL manque — le mode démo
 * (fixtures) ne touche jamais la base, donc l'app boote sans Neon.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL manquant — requis pour la persistance. Le mode démo (NEXT_PUBLIC_DEMO_MODE=true) n'a pas besoin de base.",
    );
  }
  _db = drizzle(neon(url), { schema });
  return _db;
}
