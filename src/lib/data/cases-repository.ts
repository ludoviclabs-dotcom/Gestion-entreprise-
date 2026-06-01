import type { CasesRepository } from "./types";
import { FixtureCasesRepository } from "./fixture-repository";

let _repo: CasesRepository | null = null;

/**
 * Sélecteur du repository (singleton module).
 *  - Si `DATABASE_URL` est défini → `DbCasesRepository` (Neon Postgres + Drizzle).
 *  - Sinon → `FixtureCasesRepository` (fixtures + store mémoire).
 *
 * L'UI ne dépend que de cette couture : aucun changement de code front pour
 * passer du mode démo au mode persistant.
 */
export function getCasesRepository(): CasesRepository {
  if (_repo) return _repo;
  if (process.env.DATABASE_URL) {
    // Import dynamique : évite de charger Drizzle/Neon en mode démo.
    // Le throw « DATABASE_URL manquant » de getDb() est verrouillé en amont.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DbCasesRepository } = require("./db-repository") as typeof import("./db-repository");
    _repo = new DbCasesRepository();
  } else {
    _repo = new FixtureCasesRepository();
  }
  return _repo;
}
