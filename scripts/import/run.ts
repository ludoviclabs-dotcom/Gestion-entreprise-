import { appendFile } from "node:fs/promises";
import { connectImportDatabase } from "./lib/postgres-store";
import { importCamino } from "./camino";

async function main() {
  const source = process.argv[2] ?? "check";
  if (!["check", "camino", "all"].includes(source)) throw new Error("UNKNOWN_SOURCE");
  const db = connectImportDatabase();
  try {
    await db`select id from open_data_imports limit 0`;
    let summary = "Infrastructure accessible.\n";
    if (source !== "check") {
      const started = Date.now();
      const report = await importCamino(db);
      summary += `Camino : ${report.recordCount} associations titre/SIREN ; ${report.unchanged ? "inchangé (vérification actualisée)" : "import publié"} ; ${((Date.now() - started) / 1000).toFixed(1)} s.\n`;
    }
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  } finally {
    await db.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error("Import impossible. Vérifier les migrations et le secret GitHub de connexion directe. La dernière version validée est conservée.");
  process.exitCode = 1;
});
