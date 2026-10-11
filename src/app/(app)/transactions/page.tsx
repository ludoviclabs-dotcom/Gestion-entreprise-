import { Suspense } from "react";
import TransactionsWorkspace from "@/components/transactions/TransactionsWorkspace.client";
import LoadingState from "@/components/empty/LoadingState";
import { getCasesRepository } from "@/lib/data/cases-repository";
import { curateCaseSummaries } from "@/lib/data/case-curation";

export const metadata = { title: "Transactions — KYB Graph" };

/**
 * Espace de triage des transactions. Le relevé est importé et analysé dans le
 * navigateur (aucune donnée transactionnelle n'atteint le serveur) ; le serveur
 * ne fournit que la liste des dossiers (id, titre, SIREN) pour rapprocher une
 * contrepartie de son dossier par SIREN.
 */
export default async function TransactionsPage() {
  const cases = curateCaseSummaries(await getCasesRepository().listCases()).visible.map(
    ({ id, title, rootSiren }) => ({ id, title, rootSiren }),
  );
  return (
    // useSearchParams (filtres dans l'URL) : frontière Suspense explicite.
    <Suspense fallback={<LoadingState variant="block" label="Chargement de l'espace transactions…" />}>
      <TransactionsWorkspace cases={cases} />
    </Suspense>
  );
}
