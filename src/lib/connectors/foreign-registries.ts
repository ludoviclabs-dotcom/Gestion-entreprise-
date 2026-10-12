import * as Sentry from "@sentry/nextjs";
import { isBrregEnabled, isAcraEnabled, isDemoMode } from "@/lib/env";
import { RateLimiter } from "./http";
import type { ConnectorResult } from "./types";

/**
 * Registres étrangers interrogés PAR IDENTIFIANT pour les sociétés mères repérées
 * par GLEIF (second saut, comme Companies House).
 *
 * GLEIF publie pour une mère son registre d'origine (code RA) et son numéro
 * d'immatriculation : interroger le registre officiel avec ce numéro est un
 * rapprochement EXACT — aucune homonymie possible, contrairement à un nom.
 *
 * Registres couverts (codes RA vérifiés sur l'API GLEIF le 12 octobre 2026) :
 *  - Norvège : Brønnøysundregistrene, Enhetsregisteret (RA000472), API ouverte ;
 *  - Singapour : ACRA (RA000523), jeu ouvert data.gov.sg (recherche par UEN).
 *
 * Minimisation : identité publique de la personne morale, statut, dates, forme
 * juridique — ni adresse, ni dirigeant, ni donnée personnelle.
 * Ne lève jamais : une panne est une consultation dégradée, jamais une absence ;
 * un numéro inconnu est HTTP 404 (absence : ce n'est pas une panne).
 */
export type ForeignRegistryKey = "no" | "sg";

export type ForeignRegistryEntity = {
  number: string;
  name: string;
  /** Forme juridique (code et libellé du registre). */
  form: string | null;
  /** Statut d'activité tel que publié (« Registered », « en faillite »…). */
  status: string | null;
  registeredOn: string | null;
  /** Procédures collectives / dissolution publiées par le registre. */
  bankrupt: boolean | null;
  inLiquidation: boolean | null;
  deletedOn: string | null;
  lastAccountsYear: number | null;
  industry: string | null;
  employees: number | null;
};

export type ForeignRegistryRaw = {
  status: "ok" | "not_found" | "indisponible";
  registry: ForeignRegistryKey;
  entity: ForeignRegistryEntity | null;
};

/** Codes RA GLEIF → registre. */
export const FOREIGN_REGISTRY_BY_RA: Record<string, ForeignRegistryKey> = {
  RA000472: "no",
  RA000523: "sg",
};

export const FOREIGN_REGISTRY_LABELS: Record<ForeignRegistryKey, string> = {
  no: "Registre norvégien des entités (Brønnøysund)",
  sg: "Registre de Singapour (ACRA)",
};

/** Numéro normalisé selon le registre, ou `null` si le format est invalide. */
export function normalizeRegistryNumber(registry: ForeignRegistryKey, raw: string): string | null {
  const compact = raw.replace(/[\s.\-]/g, "").toUpperCase();
  if (registry === "no") return /^\d{9}$/.test(compact) ? compact : null;
  // UEN : 9 chiffres + lettre (entreprises) ou 10 caractères alphanumériques.
  return /^[0-9A-Z]{9,10}$/.test(compact) ? compact : null;
}

/** Sociétés mères (directe / ultime) immatriculées dans un registre couvert. Pur, dédoublonné. */
export function foreignRegistryParents(
  raw: unknown,
): { lei: string; registry: ForeignRegistryKey; number: string }[] {
  const data = (raw && typeof raw === "object" ? raw : {}) as {
    directParent?: { lei?: string; registeredAs?: string | null; registrationAuthority?: string | null } | null;
    ultimateParent?: { lei?: string; registeredAs?: string | null; registrationAuthority?: string | null } | null;
  };
  const out: { lei: string; registry: ForeignRegistryKey; number: string }[] = [];
  for (const p of [data.directParent, data.ultimateParent]) {
    if (!p?.lei || !p.registeredAs || !p.registrationAuthority) continue;
    const registry = FOREIGN_REGISTRY_BY_RA[p.registrationAuthority];
    if (!registry) continue;
    const number = normalizeRegistryNumber(registry, p.registeredAs);
    if (!number || out.some((x) => x.registry === registry && x.number === number)) continue;
    out.push({ lei: p.lei, registry, number });
  }
  return out;
}

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api/enheter";
/** Jeu ACRA « Registered Entities with Unique Entity Number » (collection 1, data.gov.sg). */
const ACRA_RESOURCE = "d_3f960c10fed6145404ca7b821f263b87";
const ACRA_BASE = "https://data.gov.sg/api/action/datastore_search";
const TIMEOUT_MS = 12_000;
const brregLimiter = new RateLimiter(10, 1_000);
// data.gov.sg refuse vite les rafales anonymes : un appel toutes les 3 s.
const acraLimiter = new RateLimiter(1, 3_000);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const day = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const empty = (registry: ForeignRegistryKey, status: ForeignRegistryRaw["status"]): ForeignRegistryRaw => ({
  status, registry, entity: null,
});

/** Réponse Brønnøysund → forme minimale conservée. Pur, défensif. */
export function simplifyBrreg(json: unknown): ForeignRegistryEntity | null {
  if (!isObj(json)) return null;
  const number = str(json.organisasjonsnummer);
  const name = str(json.navn);
  if (!number || !name) return null;
  const form = isObj(json.organisasjonsform)
    ? [str(json.organisasjonsform.kode), str(json.organisasjonsform.beskrivelse)].filter(Boolean).join(" — ")
    : null;
  const industry = isObj(json.naeringskode1) ? str(json.naeringskode1.beskrivelse) : null;
  const bankrupt = bool(json.konkurs);
  const inLiquidation = bool(json.underAvvikling) === true || bool(json.underTvangsavviklingEllerTvangsopplosning) === true
    ? true
    : bool(json.underAvvikling) === null && bool(json.underTvangsavviklingEllerTvangsopplosning) === null
      ? null
      : false;
  const deletedOn = day(json.slettedato);
  const status = deletedOn ? "radiée" : bankrupt ? "en faillite" : inLiquidation ? "en liquidation" : "en activité";
  const accounts = int(json.sisteInnsendteAarsregnskap) ?? (str(json.sisteInnsendteAarsregnskap) ? Number(str(json.sisteInnsendteAarsregnskap)) : null);
  return {
    number,
    name,
    form: form || null,
    status,
    registeredOn: day(json.registreringsdatoEnhetsregisteret) ?? day(json.stiftelsesdato),
    bankrupt,
    inLiquidation,
    deletedOn,
    lastAccountsYear: Number.isInteger(accounts) ? accounts : null,
    industry,
    employees: int(json.antallAnsatte),
  };
}

/** Enregistrement ACRA → forme minimale conservée. Pur, défensif. */
export function simplifyAcra(record: unknown): ForeignRegistryEntity | null {
  if (!isObj(record)) return null;
  const number = str(record.uen);
  const name = str(record.entity_name);
  if (!number || !name) return null;
  const status = str(record.uen_status_desc);
  const inactive = status ? /cancel|struck|dissol|wound|liquidat|de-?regist/i.test(status) : null;
  return {
    number,
    name,
    form: str(record.entity_type_desc),
    status,
    registeredOn: day(record.uen_issue_date),
    bankrupt: null,
    inLiquidation: inactive,
    deletedOn: null,
    lastAccountsYear: null,
    industry: null,
    employees: null,
  };
}

async function getJson(url: string): Promise<{ status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "KYB-Graph/1.0 (veille conformité)" },
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { status: res.status, json: text ? JSON.parse(text) : null };
    } catch {
      return { status: res.status, json: null };
    }
  } finally {
    clearTimeout(timer);
  }
}

export const foreignRegistries = {
  async lookup(registry: ForeignRegistryKey, number: string): Promise<ConnectorResult<ForeignRegistryRaw>> {
    const enabled = registry === "no" ? isBrregEnabled() : isAcraEnabled();
    if (isDemoMode() || !enabled) {
      return { raw: empty(registry, "indisponible"), endpoint: `fixture:registre-${registry}:${number}`, httpStatus: 0, isFixture: true };
    }
    const normalized = normalizeRegistryNumber(registry, number);
    const url =
      registry === "no"
        ? `${BRREG_BASE}/${normalized ?? "invalide"}`
        : `${ACRA_BASE}?resource_id=${ACRA_RESOURCE}&filters=${encodeURIComponent(JSON.stringify({ uen: normalized ?? "invalide" }))}&limit=1`;
    const degraded = (httpStatus: number, suffix: string): ConnectorResult<ForeignRegistryRaw> => ({
      raw: empty(registry, "indisponible"), endpoint: `${url} ${suffix}`, httpStatus, isFixture: false,
    });
    if (!normalized) return degraded(400, "(erreur 400)");

    try {
      await (registry === "no" ? brregLimiter : acraLimiter).wait();
      const { status, json } = await getJson(url);
      if (registry === "no") {
        // 404 / 410 : numéro inconnu ou supprimé → absence (pas une panne).
        if (status === 404 || status === 410) {
          return { raw: empty(registry, "not_found"), endpoint: url, httpStatus: 404, isFixture: false };
        }
        if (status < 200 || status >= 300) return degraded(status, `(erreur ${status})`);
        const entity = simplifyBrreg(json);
        if (!entity) return degraded(status, "(schéma non reconnu)");
        return { raw: { status: "ok", registry, entity }, endpoint: url, httpStatus: status, isFixture: false };
      }
      // Singapour : l'API anonyme répond 429 (TOO_MANY_REQUESTS) sous rafale.
      if (status < 200 || status >= 300) return degraded(status, `(erreur ${status})`);
      const records = isObj(json) && isObj(json.result) && Array.isArray(json.result.records) ? json.result.records : null;
      if (!records) return degraded(status, "(schéma non reconnu)");
      if (records.length === 0) {
        return { raw: empty(registry, "not_found"), endpoint: url, httpStatus: 404, isFixture: false };
      }
      const entity = simplifyAcra(records[0]);
      if (!entity) return degraded(status, "(schéma non reconnu)");
      return { raw: { status: "ok", registry, entity }, endpoint: url, httpStatus: status, isFixture: false };
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return degraded(0, "(délai dépassé)");
      Sentry.captureException(error);
      return degraded(0, "(exception)");
    }
  },
};
