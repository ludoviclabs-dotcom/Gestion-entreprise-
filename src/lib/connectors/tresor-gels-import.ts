import * as Sentry from "@sentry/nextjs";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { GelsEntry } from "./tresor-gels-match";

/**
 * Lecture du registre national des gels (DG Trésor) depuis l'import quotidien en
 * base (`tresor_gels_entries`), à la place du téléchargement de 12 Mo que chaque
 * instance froide devait refaire (7 à 9 s).
 *
 * Garde-fous propres à un CONTRÔLE de sanctions :
 *  - une copie plus ancienne que `GELS_IMPORT_MAX_AGE_MS` (dernière VÉRIFICATION,
 *    pas dernière modification : un registre inchangé fait avancer la vérification)
 *    n'est jamais servie — l'appelant retombe sur le téléchargement direct ;
 *  - import absent, périmé, illisible ou erreur base : même repli. Le rapprochement
 *    est identique (mêmes entrées, même algorithme), donc le repli ne masque rien ;
 *  - jamais de « aucune correspondance » issu d'une copie qu'on ne peut pas dater.
 */
export const GELS_IMPORT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type ImportedGels = {
  entries: GelsEntry[];
  publicationDate: string | null;
  registerTotal: number;
  importedAt: string;
  checkedAt: string;
};
export type ImportedGelsResult =
  | { state: "fresh"; data: ImportedGels }
  | { state: "missing" | "stale" | "invalid" | "error" };

const iso = (value: unknown): string | null => {
  const t = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const asAliases = (value: unknown): string[] | null => {
  const parsed = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { return null; } })() : value;
  return Array.isArray(parsed) && parsed.every((a) => typeof a === "string") ? (parsed as string[]) : null;
};

/** Une seule requête SQL : l'en-tête d'import et ses lignes forment un snapshot cohérent. */
export async function readImportedGels(now: number = Date.now()): Promise<ImportedGelsResult> {
  try {
    const result = await getDb().execute(sql`
      with latest as (
        select id, imported_at, checked_at from open_data_imports
        where source = 'tresor_gels' and status = 'ok' order by imported_at desc limit 1
      )
      select l.imported_at, l.checked_at, e.nom, e.nature, e.aliases, e.publication_date, e.register_total
      from latest l left join tresor_gels_entries e on e.import_id = l.id
      order by e.position
    `);
    const rows = result.rows as Record<string, unknown>[];
    if (rows.length === 0) return { state: "missing" };
    const importedAt = iso(rows[0].imported_at);
    const checkedAt = iso(rows[0].checked_at);
    if (!importedAt || !checkedAt) return { state: "invalid" };
    if (now - Date.parse(checkedAt) > GELS_IMPORT_MAX_AGE_MS) return { state: "stale" };

    const entries: GelsEntry[] = [];
    for (const row of rows) {
      const aliases = asAliases(row.aliases);
      if (typeof row.nom !== "string" || !row.nom.trim() || !aliases) return { state: "invalid" };
      entries.push({ nom: row.nom, nature: typeof row.nature === "string" ? row.nature : null, aliases });
    }
    const registerTotal = Number(rows[0].register_total);
    if (!Number.isSafeInteger(registerTotal) || registerTotal < entries.length) return { state: "invalid" };
    return {
      state: "fresh",
      data: {
        entries,
        publicationDate: typeof rows[0].publication_date === "string" ? rows[0].publication_date : null,
        registerTotal,
        importedAt,
        checkedAt,
      },
    };
  } catch (error) {
    Sentry.captureException(error);
    return { state: "error" };
  }
}
