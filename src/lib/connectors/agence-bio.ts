import { env, isAgenceBioEnabled, isDemoMode } from "@/lib/env";
import { odsFetch, odsText, odsToResult } from "./opendatasoft";
import type { ConnectorResult } from "./types";

/**
 * Connecteur Agence BIO — annuaire officiel des opérateurs certifiés en
 * agriculture biologique (`opendata.agencebio.org`, API « gouv »). Ouvert, SANS
 * clé. Rapprochement par SIREN (le paramètre `siret` accepte un SIREN et
 * renvoie les établissements) ; chaque établissement est re-vérifié.
 *
 * Minimisation : seules la certification et les catégories sont conservées —
 * jamais le nom du gérant, ni coordonnées (téléphone, e-mail, adresses).
 *
 * ⚠️ Un certificat bio atteste d'une certification de production ou de
 * distribution ; son absence n'est jamais un manquement.
 */
export type BioCertificate = {
  /** Organisme certificateur. */
  body: string | null;
  /** ENGAGEE, SUSPENDUE, ARRETEE… (libellé source). */
  state: string | null;
  engagedOn: string | null;
  suspendedOn: string | null;
  stoppedOn: string | null;
};

export type BioOperator = {
  siret: string;
  categories: string[];
  certificates: BioCertificate[];
};

export type AgenceBioRaw = {
  status: "ok" | "indisponible";
  /** Nombre total d'établissements enregistrés (la liste est plafonnée). */
  total: number;
  operators: BioOperator[];
};

const LIMIT = 50;
const empty = (): AgenceBioRaw => ({ status: "indisponible", total: 0, operators: [] });
const day = (v: unknown): string | null => odsText(v)?.slice(0, 10) ?? null;
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : [];

export const agenceBio = {
  async bySiren(siren: string): Promise<ConnectorResult<unknown>> {
    if (isDemoMode() || !isAgenceBioEnabled()) {
      return {
        raw: { status: "ok", total: 0, operators: [] } satisfies AgenceBioRaw,
        endpoint: `fixture:agence-bio:${siren}`,
        httpStatus: 0,
        isFixture: true,
      };
    }
    if (!/^\d{9}$/.test(siren)) {
      return {
        raw: { status: "ok", total: 0, operators: [] } satisfies AgenceBioRaw,
        endpoint: "agence-bio:siren-invalide",
        httpStatus: 0,
        isFixture: false,
      };
    }
    const params = new URLSearchParams({ siret: siren, nb: String(LIMIT) });
    const url = `${env.AGENCE_BIO_BASE_URL}/api/gouv/operateurs/?${params}`;
    return odsToResult<AgenceBioRaw>(
      await odsFetch(url, "AGENCE_BIO"),
      url,
      (out) => {
        const operators = out.records.map<BioOperator>((r) => ({
          siret: odsText(r.siret) ?? "",
          categories: arr(r.categories)
            .map((c) => odsText(c.nom))
            .filter((n): n is string => Boolean(n)),
          certificates: arr(r.certificats).map<BioCertificate>((c) => ({
            body: odsText(c.organisme),
            state: odsText(c.etatCertification),
            engagedOn: day(c.dateEngagement),
            suspendedOn: day(c.dateSuspension),
            stoppedOn: day(c.dateArret),
          })),
        }));
        if (operators.some((o) => !o.siret.startsWith(siren))) {
          throw new Error("Agence BIO: filtre SIREN ignoré par la source");
        }
        return { status: "ok", total: out.total, operators };
      },
      empty,
    );
  },
};
