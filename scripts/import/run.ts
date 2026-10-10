import { appendFile } from "node:fs/promises";
import { connectImportDatabase } from "./lib/postgres-store";
import { importCamino } from "./camino";
import type { ImportReport } from "./lib/runner";
import { importIcpe, type IcpeStats } from "./icpe";

async function summary(text: string) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text + "\n");
}
async function main() {
  const source = process.argv[2] ?? "check";
  if (!["check", "camino", "icpe", "all"].includes(source)) throw new Error("UNKNOWN_SOURCE");
  const db = connectImportDatabase();
  try {
    await db`select id from open_data_imports limit 0`;
    if (source === "check") await summary("Infrastructure accessible.");
    for (const key of source === "all" ? ["camino", "icpe"] : source === "check" ? [] : [source]) {
      const started = Date.now();
      const report: ImportReport & { stats?: IcpeStats } = key === "camino" ? await importCamino(db) : await importIcpe(db);
      const stats = report.stats ? ` Reçues : ${report.stats.received} ; Non ICPE exclus : ${report.stats.nonIcpe} ; identifiants inutilisables : ${report.stats.unusableIdentifier}.` : "";
      await summary(`${key} : ${report.recordCount} lignes ; ${report.unchanged ? "inchangé (vérification actualisée)" : "import publié"} ; ${((Date.now() - started) / 1000).toFixed(1)} s.${stats}`);
    }
  } finally { await db.end({ timeout: 5 }); }
}
main().catch(() => {
  console.error("Import impossible. Vérifier les migrations, le secret GitHub direct et la source publique. Pour le jeu en échec, la dernière version validée est conservée.");
  process.exitCode = 1;
});
