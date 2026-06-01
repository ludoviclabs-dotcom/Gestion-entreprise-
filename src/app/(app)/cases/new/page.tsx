import NewCaseDialog from "@/components/cases/NewCaseDialog.client";

export const metadata = { title: "Nouveau dossier — KYB Graph" };

export default function NewCasePage() {
  // La page ouvre directement le dialog de création (jumeau de l'action ⌘K).
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Nouveau dossier
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Créez un dossier de cartographie à partir d&apos;un SIREN.
      </p>
      <NewCaseDialog defaultOpen />
    </div>
  );
}
