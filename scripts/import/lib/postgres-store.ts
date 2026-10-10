import { randomUUID } from "node:crypto";
import postgres, { type Sql, type TransactionSql } from "postgres";
import type { ImportIdentity, ImportStore, ImportTransaction } from "./runner";

export type DatasetWriter<T> = {
  write: (tx: TransactionSql, importId: string, rows: T[]) => Promise<void>;
  count: (tx: TransactionSql, importId: string) => Promise<number>;
  prune: (tx: TransactionSql, keepImportId: string) => Promise<void>;
};

export function connectImportDatabase(): Sql {
  // Aucun chargement de .env.local : le secret local est périmé.
  const value = process.env.DATABASE_URL_UNPOOLED;
  if (!value) throw new Error("DATABASE_SECRET_REQUIRED");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("DATABASE_SECRET_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname.includes("-pooler")) {
    throw new Error("DIRECT_DATABASE_CONNECTION_REQUIRED");
  }
  return postgres(value, { max: 1, ssl: "require", connect_timeout: 20, idle_timeout: 20, onnotice: () => {}, debug: false });
}

export function postgresImportStore<T>(db: Sql, writer: DatasetWriter<T>): ImportStore<T> {
  return {
    async transaction<R>(identity: ImportIdentity, work: (tx: ImportTransaction<T>) => Promise<R>): Promise<R> {
      const id = randomUUID();
      const startedAt = new Date();
      try {
        const result = await db.begin(async (tx) => {
          // La perte de connexion fait échouer la transaction ET libère le verrou.
          await tx`select set_config('lock_timeout', '5s', true)`;
          await tx`select set_config('statement_timeout', '60s', true)`;
          await tx`select pg_advisory_xact_lock(hashtext('kyb-open-data'), hashtext(${identity.source}))`;
          await tx`insert into open_data_imports (id, source, version, source_url, status, started_at)
            values (${id}, ${identity.source}, ${identity.version}, ${identity.sourceUrl}, 'running', ${startedAt})`;
          return work({
            write: (rows) => writer.write(tx, id, rows),
            count: () => writer.count(tx, id),
            publish: async (sha256, count) => {
              const previous = await tx`select id, sha256, version from open_data_imports
                where source = ${identity.source} and status = 'ok' order by imported_at desc limit 1`;
              if (previous[0]?.sha256 === sha256 && previous[0]?.version === identity.version) {
                // Les tables des jeux ont une FK import_id ON DELETE CASCADE.
                await tx`delete from open_data_imports where id = ${id}`;
                await tx`update open_data_imports set checked_at = clock_timestamp() where id = ${previous[0].id}`;
                return true;
              }
              await tx`update open_data_imports set status = 'ok', sha256 = ${sha256}, record_count = ${count},
                imported_at = clock_timestamp(), checked_at = clock_timestamp() where id = ${id}`;
              await writer.prune(tx, id);
              return false;
            },
          });
        });
        return result as R;
      } catch {
        // Après rollback : métadonnées d'échec uniquement, jamais l'erreur brute.
        // Classer la tentative à sa fin : elle a pu attendre un import précédent.
        await db`insert into open_data_imports (id, source, version, source_url, status, started_at, checked_at)
          values (${id}, ${identity.source}, ${identity.version}, ${identity.sourceUrl}, 'failed', ${startedAt}, clock_timestamp())`.catch(() => {});
        throw new Error("IMPORT_FAILED_PREVIOUS_DATA_PRESERVED");
      }
    },
  };
}
