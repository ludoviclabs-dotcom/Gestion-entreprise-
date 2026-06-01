/** Limiteur de débit simple (fenêtre glissante) — protège des quotas API. */
export class RateLimiter {
  private hits: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  async wait(): Promise<void> {
    const now = Date.now();
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.max) {
      const oldest = this.hits[0];
      await sleep(this.windowMs - (now - oldest));
      return this.wait();
    }
    this.hits.push(Date.now());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  limiter?: RateLimiter;
}

/** fetch JSON avec timeout, 1 retry par défaut sur 429/5xx (backoff), et rate limit optionnel. */
export async function fetchJson<T>(
  url: string,
  opts: FetchOptions = {},
): Promise<{ data: T; status: number }> {
  const { headers, timeoutMs = 10_000, retries = 1, limiter } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (limiter) await limiter.wait();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      const data = (await res.json()) as T;
      return { data, status: res.status };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Échec de la requête : ${url}`);
}
