import * as Sentry from "@sentry/nextjs";
import { env, isDemoMode, isCompaniesHouseEnabled } from "@/lib/env";
import { RateLimiter } from "./http";
import companiesHouseFixture from "@/lib/fixtures/companies-house.sample.json";
import type { ConnectorResult } from "./types";

/**
 * Connecteur Companies House (registre officiel britannique, gratuit).
 *
 * Sert de SECOND SAUT : un SIREN français n'a pas de numéro britannique, mais
 * GLEIF publie, pour les sociétés mères, le registre (RA000585/586/587) et le
 * numéro d'immatriculation. On interroge alors Companies House pour les
 * dirigeants en fonction et les personnes à contrôle significatif (PSC).
 *
 * Auth : HTTP Basic, clé API en nom d'utilisateur et mot de passe vide. La clé
 * n'est JAMAIS journalisée ni placée dans l'endpoint enregistré.
 * Quota officiel : 600 requêtes / 5 min.
 *
 * Minimisation : on ne conserve ni dates de naissance, ni adresses, ni
 * nationalités — seulement identité publique, fonction et dates de fonction.
 *
 * Modes (calqués sur les connecteurs opt-in) :
 *  - démo / flag absent → fixture synthétique ;
 *  - live OK → données réelles ;
 *  - numéro inconnu → HTTP 404 (absence : ce n'est PAS une panne) ;
 *  - live en échec (401/403/429/5xx, exception) → résultat vide dégradé + Sentry.
 */

export type ChOfficer = {
  name: string;
  role: string;
  corporate: boolean;
  appointedOn: string | null;
  resignedOn: string | null;
};

export type ChPsc = {
  name: string;
  kind: string;
  corporate: boolean;
  natures: string[];
  notifiedOn: string | null;
  ceasedOn: string | null;
  registrationNumber: string | null;
};

export type ChCompany = {
  number: string;
  name: string;
  status: string | null;
  type: string | null;
  createdOn: string | null;
  jurisdiction: string | null;
  sicCodes: string[];
};

export type CompaniesHouseRaw = {
  status: "ok" | "not_found" | "indisponible";
  company: ChCompany | null;
  /** Dirigeants EN FONCTION uniquement (les démissionnaires sont comptés). */
  officers: ChOfficer[];
  officersTotal: number;
  officersActive: number;
  /** PSC (dont ceux dont le contrôle a cessé : filtrés par le normaliseur). */
  pscs: ChPsc[];
  pscTotal: number;
};

const limiter = new RateLimiter(100, 60_000);
const TIMEOUT_MS = 15_000;
const PAGE_SIZE = 100;

function shouldMock(): boolean {
  return isDemoMode() || !isCompaniesHouseEnabled();
}

/**
 * Normalise un numéro de société : majuscules, zéros initiaux conservés. Un
 * numéro purement numérique est complété à 8 chiffres ; sinon préfixe lettres
 * (SC, NI, OC, SO…) + chiffres. Renvoie null si le format est invalide.
 */
export function normalizeCompanyNumber(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{1,8}$/.test(raw)) return raw.padStart(8, "0");
  if (/^[A-Z]{1,2}\d{6}$/.test(raw)) return raw;
  return null;
}

const empty = (status: CompaniesHouseRaw["status"]): CompaniesHouseRaw => ({
  status,
  company: null,
  officers: [],
  officersTotal: 0,
  officersActive: 0,
  pscs: [],
  pscTotal: 0,
});

type Json = Record<string, unknown>;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const arr = (v: unknown): Json[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : [];

async function get(
  url: string,
  authorization: string,
): Promise<{ status: number; json: Json | null }> {
  await limiter.wait();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: authorization, Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      const parsed: unknown = JSON.parse(text);
      return {
        status: res.status,
        json: parsed && typeof parsed === "object" ? (parsed as Json) : null,
      };
    } catch {
      return { status: res.status, json: null };
    }
  } finally {
    clearTimeout(timer);
  }
}

export const companiesHouse = {
  async byNumber(companyNumber: string): Promise<ConnectorResult<unknown>> {
    if (shouldMock()) {
      return {
        raw: companiesHouseFixture,
        endpoint: `fixture:companies-house:${companyNumber}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    const base = env.COMPANIES_HOUSE_BASE_URL;
    const number = normalizeCompanyNumber(companyNumber);
    if (!number) {
      return {
        raw: empty("not_found"),
        endpoint: `${base}/company/${encodeURIComponent(companyNumber)}`,
        httpStatus: 404,
        isFixture: false,
      };
    }
    const endpoint = `${base}/company/${number}`;
    const authorization =
      "Basic " + Buffer.from(`${env.COMPANIES_HOUSE_API_KEY ?? ""}:`).toString("base64");
    const degraded = (httpStatus: number, suffix: string): ConnectorResult<unknown> => ({
      raw: empty("indisponible"),
      endpoint: `${endpoint} ${suffix}`,
      httpStatus,
      isFixture: false,
    });

    try {
      const company = await get(endpoint, authorization);
      if (company.status === 404) {
        return { raw: empty("not_found"), endpoint, httpStatus: 404, isFixture: false };
      }
      if (company.status < 200 || company.status >= 300 || !company.json) {
        Sentry.captureMessage(`Companies House: HTTP ${company.status}`, "warning");
        return company.status >= 200 && company.status < 300
          ? degraded(company.status, "(schéma non reconnu)")
          : degraded(company.status, `(erreur ${company.status})`);
      }

      const [officersRes, pscRes] = await Promise.all([
        get(`${endpoint}/officers?items_per_page=${PAGE_SIZE}`, authorization),
        get(
          `${endpoint}/persons-with-significant-control?items_per_page=${PAGE_SIZE}`,
          authorization,
        ),
      ]);
      // Une liste en ERREUR n'est pas une liste vide : on dégrade tout le résultat
      // plutôt que d'affirmer « aucun dirigeant ». (404 PSC = aucune déclaration.)
      for (const r of [officersRes, pscRes]) {
        const isPsc = r === pscRes;
        if (r.status === 404 && isPsc) continue;
        if (r.status < 200 || r.status >= 300) {
          Sentry.captureMessage(`Companies House: HTTP ${r.status}`, "warning");
          return degraded(r.status, `(erreur ${r.status})`);
        }
      }

      const c = company.json;
      const rawOfficers = arr(officersRes.json?.items);
      const active = rawOfficers.filter((o) => !str(o.resigned_on));
      const raw: CompaniesHouseRaw = {
        status: "ok",
        company: {
          number: str(c.company_number) ?? number,
          name: str(c.company_name) ?? number,
          status: str(c.company_status),
          type: str(c.type),
          createdOn: str(c.date_of_creation),
          jurisdiction: str(c.jurisdiction),
          sicCodes: Array.isArray(c.sic_codes)
            ? (c.sic_codes as unknown[]).filter((s): s is string => typeof s === "string")
            : [],
        },
        officers: active.map((o) => {
          const role = str(o.officer_role) ?? "officer";
          return {
            name: str(o.name) ?? "(nom non publié)",
            role,
            corporate: role.startsWith("corporate-") || role.startsWith("judicial-factor"),
            appointedOn: str(o.appointed_on),
            resignedOn: null,
          };
        }),
        officersTotal: Number(officersRes.json?.total_results ?? rawOfficers.length),
        officersActive: Number(officersRes.json?.active_count ?? active.length),
        pscs: arr(pscRes.json?.items).map((p) => {
          const kind = str(p.kind) ?? "unknown";
          const ident = (p.identification ?? {}) as Json;
          return {
            name: str(p.name) ?? "(nom non publié)",
            kind,
            corporate:
              kind.startsWith("corporate-entity") || kind.startsWith("legal-person"),
            natures: Array.isArray(p.natures_of_control)
              ? (p.natures_of_control as unknown[]).filter(
                  (s): s is string => typeof s === "string",
                )
              : [],
            notifiedOn: str(p.notified_on),
            ceasedOn: str(p.ceased_on),
            registrationNumber: str(ident.registration_number),
          };
        }),
        pscTotal: Number(pscRes.json?.total_results ?? 0),
      };
      return { raw, endpoint, httpStatus: company.status, isFixture: false };
    } catch (error) {
      Sentry.captureException(error);
      return degraded(0, "(exception)");
    }
  },
};
