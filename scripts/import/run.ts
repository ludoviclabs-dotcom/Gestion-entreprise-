import { appendFile } from "node:fs/promises";
import { connectImportDatabase } from "./lib/postgres-store";
import { importCamino } from "./camino";
import type { ImportReport } from "./lib/runner";
import { importIcpe, type IcpeStats } from "./icpe";
import { importGels, type GelsStats } from "./tresor-gels";
import { runSources } from "./lib/run-sources";

async function summary(text: string) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}
/** Jeux importés par « all » (et par le rendez-vous mensuel), dans cet ordre. */
const ALL_SOURCES = ["camino", "icpe", "tresor_gels"] as const;
type Key = (typeof ALL_SOURCES)[number];
const isKey = (value: string): value is Key => (ALL_SOURCES as readonly string[]).includes(value);

async function main() {
  const source = process.argv[2] ?? "check";
  if (source !== "check" && source !== "all" && !isKey(source)) throw new Error("UNKNOWN_SOURCE");
  const db = connectImportDatabase();
  try {
    await db`select id from open_data_imports limit 0`;
    if (source === "check") await summary("Infrastructure accessible.");
    const keys: readonly string[] = source === "all" ? ALL_SOURCES : source === "check" ? [] : [source];
    await runSources(keys, async (key) => {
      const started = Date.now();
      let report: ImportReport & { stats?: IcpeStats | GelsStats };
      let detail = "";
      if (key === "camino") report = await importCamino(db);
      else if (key === "icpe") {
        const r = await importIcpe(db);
        report = r;
        detail = ` Reçues : ${r.stats.received} ; Non ICPE exclus : ${r.stats.nonIcpe} ; identifiants inutilisables : ${r.stats.unusableIdentifier}.`;
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
