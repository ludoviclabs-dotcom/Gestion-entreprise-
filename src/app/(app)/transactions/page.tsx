import TransactionAnalyzer from "@/components/transactions/TransactionAnalyzer.client";

export const metadata = { title: "Analyse transactionnelle" };

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Analyse transactionnelle
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Importez un relevé (CSV) pour détecter des signaux statistiques : loi de
        Benford, doublons, montants aberrants, réutilisation d&apos;IBAN. Couche
        flux (P2P / VIGIL-AML). Aucune donnée n&apos;est envoyée à un serveur —
        l&apos;analyse est entièrement locale.
      </p>
      <div className="mt-6">
        <TransactionAnalyzer />
      </div>
    </div>
  );
}
