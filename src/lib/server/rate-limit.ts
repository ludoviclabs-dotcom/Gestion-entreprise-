/**
 * Rate limiter token-bucket en mémoire, par clé (IP, user-id…). Suffisant
 * pour la prod single-instance / démo. Pour multi-instance (Vercel
 * serverless concurrent) → `@upstash/ratelimit` + Upstash Redis (Marketplace
 * Vercel) ; il suffit de remplacer cet adapter.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * @param key      identifiant unique (souvent l'IP de l'appelant)
 * @param limit    nombre max d'événements dans la fenêtre
 * @param windowMs fenêtre de comptage
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };
  // Recharge linéaire des tokens en fonction du temps écoulé.
  const elapsed = now - bucket.updatedAt;
  const refill = (elapsed / windowMs) * limit;
  const tokens = Math.min(limit, bucket.tokens + refill);
  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    const retryAfterMs = Math.ceil(((1 - tokens) * windowMs) / limit);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return {
    allowed: true,
    remaining: Math.floor(tokens - 1),
    retryAfterMs: 0,
  };
}

/** Extrait une clé d'IP raisonnable depuis une Request Next.js. */
export function ipKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}
