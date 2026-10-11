import { Readable } from "node:stream";
import type { Sql } from "postgres";
import { extractGelsEntries } from "../../src/lib/connectors/tresor-gels-match";
import { download, Fingerprint } from "./lib/stream";
import { runImport, type ImportInput } from "./lib/runner";
import { postgresImportStore, type DatasetWriter } from "./lib/postgres-store";

export const GELS_URL = "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-flux-json";
// Le User-Agent est obligatoire depuis le 21/01/2025 (même valeur que le connecteur).
export const GELS_HEADERS = { Accept: "application/json", "User-Agent": "KYB-Graph/1.0 (screening gels des avoirs)" };
export type GelsRow = {
  position: number; nom: string; nature: string | null; aliases: string[];
  publication_date: string | null; register_total: number;
};
export type GelsStats = { received: number; naturalPersons: number };

const MAX_BYTES = 64 * 1024 * 1024;
/** Le registre compte ≈ 6 600 entrées (≈ 2 000 hors personnes physiques). */
const MIN_REGISTER_ENTRIES = 500;
const MIN_KEPT_ENTRIES = 100;
const MAX_FIELD = 4000;
const isNaturalPerson = (nature: string | null) => /physique/i.test(nature ?? "");

/**
 * Le registre est un seul JSON (≈ 12 Mo) : lu en entier, borné à 64 Mio, puis
 * projeté. Les personnes physiques ne sont jamais conservées : le rapprochement
 * les écarte déjà (cf. matchGelsEntries) et aucune autre fonction ne les utilise.
 * Seuls nom, nature et alias des personnes morales/navires sont projetés — ni
 * identifications, adresses, dates de naissance ni commentaires du registre.
 */
export function gelsInput(source: Readable, options: { minimumEntries?: number } = {}): ImportInput<GelsRow> & { stats: GelsStats } {
  const minimum = options.minimumEntries ?? MIN_REGISTER_ENTRIES;
  const fp = new Fingerprint(MAX_BYTES);
  const stats: GelsStats = { received: 0, naturalPersons: 0 };
  let complete = false;
  async function* rows(): AsyncGenerator<GelsRow> {
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of fp.measure(source)) chunks.push(Buffer.from(chunk));
    } finally { source.destroy(); }
    let publication: unknown;
    try { publication = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new Error("GELS_INVALID_JSON"); }
    chunks.length = 0;
    // Schéma non reconnu ≠ registre vide : aucun import n'est publié.
    const extraction = extractGelsEntries(publication);
    if (extraction.status !== "ok") throw new Error("GELS_SCHEMA_UNRECOGNIZED");
    const total = extraction.entries.length;
    if (total < minimum) throw new Error("GELS_INCOMPLETE_SOURCE");
    stats.received = total;
    let position = 0;
    for (const entry of extraction.entries) {
      if (isNaturalPerson(entry.nature)) { stats.naturalPersons++; continue; }
      if ([entry.nom, entry.nature ?? "", ...entry.aliases].some(v => v.length > MAX_FIELD)) throw new Error("GELS_FIELD_TOO_LONG");
      yield { position: position++, nom: entry.nom, nature: entry.nature, aliases: entry.aliases,
        publication_date: extraction.publicationDate, register_total: total };
    }
    if (position < Math.min(MIN_KEPT_ENTRIES, minimum)) throw new Error("GELS_INCOMPLETE_SOURCE");
    complete = true;
  }
  return { rows: rows(), stats, fingerprint: () => {
    if (!complete) throw new Error("GELS_INCOMPLETE_SOURCE");
    return fp.finish();
  } };
}

export const gelsWriter: DatasetWriter<GelsRow> = {
  async write(tx, importId, rows) {
    await tx`insert into tresor_gels_entries ${tx(rows.map(r => ({ ...r, aliases: JSON.stringify(r.aliases), import_id: importId })))}
      on conflict (import_id, position) do update set nom = excluded.nom, nature = excluded.nature,
        aliases = excluded.aliases, publication_date = excluded.publication_date,
        register_total = excluded.register_total`;
  },
  async count(tx, id) {
    const rows = await tx`select count(*)::int as count from tresor_gels_entries where import_id = ${id}`;
    return Number(rows[0].count);
  },
  async prune(tx, id) { await tx`delete from tresor_gels_entries where import_id <> ${id}`; },
};

export async function importGels(db: Sql) {
  let input: ReturnType<typeof gelsInput> | null = null;
  const report = await runImport({ source: "tresor_gels", version: "tresor-gels-v1", sourceUrl: GELS_URL },
    async () => {
      input = gelsInput(await download(GELS_URL, AbortSignal.timeout(5 * 60 * 1000), GELS_HEADERS));
      return input;
    },
    postgresImportStore(db, gelsWriter));
  return { ...report, stats: (input as ReturnType<typeof gelsInput> | null)?.stats };
}
