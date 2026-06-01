import Link from "next/link";
import { Button } from "@/components/ui/button";
import CasesTable from "@/components/cases/CasesTable.client";
import { getCasesRepository } from "@/lib/data/cases-repository";

export const metadata = { title: "Dossiers — KYB Graph" };

export default async function CasesPage() {
  const cases = await getCasesRepository().listCases();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            Dossiers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tous vos dossiers de cartographie de conformité.
          </p>
        </div>
        <Button asChild>
          <Link href="/cases/new">Nouveau dossier</Link>
        </Button>
      </div>
      <CasesTable cases={cases} />
    </div>
  );
}
