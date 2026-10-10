import { batches } from "./stream";

export type ImportIdentity = { source: string; version: string; sourceUrl: string };
export type ImportReport = { source: string; recordCount: number; unchanged: boolean; sha256: string };
export type ImportInput<T> = { rows: AsyncIterable<T>; fingerprint: () => string };
export interface ImportTransaction<T> {
  write: (rows: T[]) => Promise<void>;
  count: () => Promise<number>;
  publish: (sha256: string, count: number) => Promise<boolean>;
}
export interface ImportStore<T> {
  transaction: <R>(identity: ImportIdentity, work: (tx: ImportTransaction<T>) => Promise<R>) => Promise<R>;
}

/** Une transaction exclusive par source ; jamais de publication avant la fin validée. */
export async function runImport<T>(identity: ImportIdentity, open: () => Promise<ImportInput<T>>, store: ImportStore<T>): Promise<ImportReport> {
  return store.transaction(identity, async (tx) => {
    const input = await open();
    for await (const batch of batches(input.rows)) await tx.write(batch);
    const sha256 = input.fingerprint();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("INVALID_FINGERPRINT");
    const recordCount = await tx.count();
    if (!Number.isSafeInteger(recordCount) || recordCount < 1) throw new Error("EMPTY_IMPORT");
    const unchanged = await tx.publish(sha256, recordCount);
    return { source: identity.source, recordCount, sha256, unchanged };
  });
}
