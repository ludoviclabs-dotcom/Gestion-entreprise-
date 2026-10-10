import * as Sentry from "@sentry/nextjs";
import { RateLimiter } from "./http";
import type { ConnectorResult } from "./types";

/**
 * Socle commun des jeux de données ouverts de la DILA (Opendatasoft Explore v2.1) :
 * BALO, BOAMP, JOAFE / DCA. API publique, sans clé.
 *
 * Responsabilités : construire l'URL (valeurs échappées), timeout, UNE nouvelle
 * tentative sur 429 (Retry-After plafonné), et classer l'issue — jamais une
 * exception, jamais un corps d'erreur lu comme une donnée.
 */

export type OdsRecord = Record<string, unknown>;

export type OdsOutcome =
  | { ok: true; status: number; total: number; records: OdsRecord[] }
  | { ok: false; status: number; reason: "http" | "schema" | "exception" };

const limiter = new RateLimiter(5, 1_000);
const TIMEOUT_MS = 15_000;
const MAX_RETRY_AFTER_MS = 3_000;

/** Échappe une valeur littérale dans une clause `where` ODSQL. */
export function odsLiteral(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function odsUrl(opts: {
  baseUrl: string;
  dataset: string;
  where: string;
  orderBy?: string;
  select?: string[];
  limit?: number;
}): string {
  const p = new URLSearchParams();
  p.set("where", opts.where);
  p.set("limit", String(opts.limit ?? 20));
  if (opts.orderBy) p.set("order_by", opts.orderBy);
  if (opts.select?.length) p.set("select", opts.select.join(","));
  return `${opts.baseUrl}/api/explore/v2.1/catalog/datasets/${opts.dataset}/records?${p.toString()}`;
}

export async function odsFetch(url: string, label: string): Promise<OdsOutcome> {
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await limiter.wait();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      let text: string;
      try {
        res = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": "KYB-Graph/1.0" },
          signal: controller.signal,
        });
        text = await res.text();
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 429 && attempt === 0) {
        const wait = Number(res.headers.get("retry-after")) * 1000;
        await new Promise((r) =>
          setTimeout(r, Math.min(Number.isFinite(wait) && wait > 0 ? wait : 1_000, MAX_RETRY_AFTER_MS)),
        );
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        Sentry.captureMessage(`${label}: HTTP ${res.status}`, "warning");
        return { ok: false, status: res.status, reason: "http" };
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        Sentry.captureMessage(`${label}: réponse non JSON`, "warning");
        return { ok: false, status: res.status, reason: "schema" };
      }
      const obj = json as { results?: unknown; total_count?: unknown };
      if (!obj || typeof obj !== "object" || !Array.isArray(obj.results)) {
        Sentry.captureMessage(`${label}: schéma inattendu`, "warning");
        return { ok: false, status: res.status, reason: "schema" };
      }
      const records = obj.results.filter(
        (r): r is OdsRecord => !!r && typeof r === "object" && !Array.isArray(r),
      );
      const total = typeof obj.total_count === "number" ? obj.total_count : records.length;
      return { ok: true, status: res.status, total, records };
    }
    return { ok: false, status: 429, reason: "http" };
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false, status: 0, reason: "exception" };
  }
}

/** Convertit une issue en `ConnectorResult` (dégradé explicite si échec). */
export function odsToResult<T extends { status: "ok" | "indisponible" }>(
  outcome: OdsOutcome,
  url: string,
  build: (out: Extract<OdsOutcome, { ok: true }>) => T,
  empty: () => T,
): ConnectorResult<unknown> {
  if (outcome.ok) {
    return { raw: build(outcome), endpoint: url, httpStatus: outcome.status, isFixture: false };
  }
  const suffix =
    outcome.reason === "http"
      ? `(erreur ${outcome.status})`
      : outcome.reason === "schema"
        ? "(schéma non reconnu)"
        : "(exception)";
  return {
    raw: empty(),
    endpoint: `${url} ${suffix}`,
    httpStatus: outcome.status,
    isFixture: false,
  };
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Premier texte d'un champ qui peut être une chaîne ou une liste de chaînes. */
export function firstText(v: unknown): string | null {
  if (Array.isArray(v)) return v.map(str).find(Boolean) ?? null;
  return str(v);
}

/** Liste de textes d'un champ chaîne ou liste (valeurs vides écartées). */
export function textList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((x): x is string => Boolean(x));
  const s = str(v);
  return s ? [s] : [];
}

/** Décode les entités HTML que BOAMP laisse dans certains libellés (« d&#039;… »). */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export { str as odsText };
