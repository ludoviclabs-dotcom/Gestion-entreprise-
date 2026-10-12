import NewCaseDialog from "@/components/cases/NewCaseDialog.client";

export const metadata = { title: "Nouveau dossier — KYB Graph" };

// La création de dossier planifie la collecte de presse APRÈS la réponse (`after()`) ;
// elle retente jusqu'à 90 s (GDELT sature). Durée allouée à l'action de création.
export const maxDuration = 120;

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
