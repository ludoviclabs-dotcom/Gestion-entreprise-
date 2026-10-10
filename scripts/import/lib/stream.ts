import { createHash } from "node:crypto";
import { Readable } from "node:stream";

/** Backpressure conservée : aucun tableau de la taille du fichier source. */
export async function* batches<T>(rows: AsyncIterable<T>, size = 500): AsyncGenerator<T[]> {
  if (!Number.isInteger(size) || size < 1 || size > 1000) throw new Error("INVALID_BATCH_SIZE");
  let batch: T[] = [];
  for await (const row of rows) {
    batch.push(row);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

/** Empreinte des octets décompressés effectivement consommés, ordre des pages inclus. */
export class Fingerprint {
  private readonly hash = createHash("sha256");
  private complete = false;
  private measuring = false;
  private failed = false;
  bytes = 0;

  constructor(private readonly maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("INVALID_BYTE_LIMIT");
  }

  async *measure(input: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
    if (this.complete || this.measuring || this.failed) throw new Error("INCOMPLETE_SOURCE");
    this.measuring = true;
    let exhausted = false;
    try {
      for await (const chunk of input) {
        this.bytes += chunk.byteLength;
        if (this.bytes > this.maxBytes) throw new Error("SOURCE_TOO_LARGE");
        this.hash.update(chunk);
        yield chunk;
      }
      exhausted = true;
    } finally {
      this.measuring = false;
      if (!exhausted) this.failed = true;
    }
  }

  /** L'adaptateur n'appelle finish qu'après validation du fichier/de toutes les pages. */
  finish(): string {
    if (this.complete || this.measuring || this.failed || this.bytes === 0) throw new Error("INCOMPLETE_SOURCE");
    this.complete = true;
    return this.hash.digest("hex");
  }
}

/** URL publique fixée par l'adaptateur ; pas d'URL issue du formulaire Actions. */
export async function download(url: string, signal: AbortSignal): Promise<Readable> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("INVALID_SOURCE_URL");
  const response = await fetch(url, { signal, redirect: "error" });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("SOURCE_HTTP_ERROR");
  }
  return Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>);
}
