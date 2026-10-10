import { appendFile } from "node:fs/promises";
import { connectImportDatabase } from "./lib/postgres-store";

/** D0 vérifie le socle ; D1/D2 ajoutent leurs vrais importeurs à cette commande. */
async function main() {
  const source = process.argv[2] ?? "check";
  if (source !== "check" && source !== "all") throw new Error("UNKNOWN_SOURCE");
  const db = connectImportDatabase();
  try {
    await db`select id, source, status, record_count, imported_at from open_data_imports limit 0`;
    const summary = "Infrastructure accessible. Aucun jeu importé : importeurs Camino et ICPE prévus en D1/D2.\n";
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  } finally {
    await db.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error("Import impossible. Vérifier le SQL D0 et le secret GitHub DATABASE_URL_UNPOOLED (connexion directe). Aucun jeu n'a été publié.");
  process.exitCode = 1;
});
