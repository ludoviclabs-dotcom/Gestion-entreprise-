/** Les jeux sont indépendants : une panne ne bloque pas les suivants. */
export async function runSources(
  sources: readonly string[],
  run: (source: string) => Promise<void>,
  report: (message: string) => Promise<void>,
): Promise<void> {
  let failed = false;
  for (const source of sources) {
    try { await run(source); }
    catch {
      failed = true;
      // Ne jamais transmettre l'erreur brute (elle peut contenir le secret DB).
      await report(`${source} : import en échec ; la dernière version validée est conservée.`).catch(() => {});
    }
  }
  if (failed) throw new Error("ONE_OR_MORE_IMPORTS_FAILED");
}
