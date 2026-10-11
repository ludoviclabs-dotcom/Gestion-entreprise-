import { appendFile } from "node:fs/promises";
import { connectImportDatabase } from "./lib/postgres-store";
import { importCamino } from "./camino";
import { importHatvp, type HatvpStats } from "./hatvp";
import type { ImportReport } from "./lib/runner";
import { importIcpe, type IcpeStats } from "./icpe";
import { importGels, type GelsStats } from "./tresor-gels";
import { importSanctionsList, type SanctionsStats } from "./sanctions";
import { listOfSource, sourcesFor } from "./lib/groups";
import { runSources } from "./lib/run-sources";

async function summary(text: string) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}

async function main() {
  const source = process.argv[2] ?? "check";
  const keys = sourcesFor(source);
  if (!keys) throw new Error("UNKNOWN_SOURCE");
  const db = connectImportDatabase();
  try {
    await db`select id from open_data_imports limit 0`;
    if (source === "check") await summary("Infrastructure accessible.");
    await runSources(keys, async (key) => {
      const started = Date.now();
      let report: ImportReport & { stats?: IcpeStats | GelsStats | SanctionsStats | HatvpStats };
      let detail = "";
      const list = listOfSource(key);
      if (key === "camino") report = await importCamino(db);
      else if (key === "icpe") {
        const r = await importIcpe(db);
        report = r;
        detail = ` Reçues : ${r.stats.received} ; Non ICPE exclus : ${r.stats.nonIcpe} ; identifiants inutilisables : ${r.stats.unusableIdentifier}.`;
      } else if (key === "hatvp") {
        const r = await importHatvp(db);
        report = r;
        detail = ` Organisations : ${r.stats.organisations} ; SIREN valides reçus : ${r.stats.sirenRecords} ; non rapprochables : ${r.stats.unusableIdentifier} ; doublons fusionnés : ${r.stats.duplicates} ; catégories inconnues : ${r.stats.unknownCategory} ; SHA-256 : ${r.sha256}.`;
      } else if (list) {
        const r = await importSanctionsList(db, list);
        report = r;
        if (r.stats) {
          detail = ` Entrées reçues : ${r.stats.received} ; personnes non conservées : ${r.stats.individuals} ; navires/aéronefs : ${r.stats.vessels} ; radiées : ${r.stats.delisted} ; sans nom latin : ${r.stats.nonLatin}.`;
        }
      } else {
        const r = await importGels(db);
        report = r;
        if (r.stats) detail = ` Entrées du registre : ${r.stats.received} ; personnes physiques non conservées : ${r.stats.naturalPersons}.`;
      }
      await summary(`${key} : ${report.recordCount} lignes ; ${report.unchanged ? "inchangé (vérification actualisée)" : "import publié"} ; ${((Date.now() - started) / 1000).toFixed(1)} s.${detail}`);
    }, summary);
  } finally { await db.end({ timeout: 5 }); }
}
main().catch(() => {
  console.error("Import impossible. Vérifier les migrations, le secret GitHub direct et la source publique. Pour le jeu en échec, la dernière version validée est conservée.");
  process.exitCode = 1;
});
