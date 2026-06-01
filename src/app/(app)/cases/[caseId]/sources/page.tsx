import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getCasesRepository } from "@/lib/data/cases-repository";
import EmptyState from "@/components/empty/EmptyState";

const SOURCE_LABELS: Record<string, string> = {
  sirene: "INSEE Sirene",
  bodacc: "BODACC",
  inpi: "INPI / RNE",
  tresor_gels: "DG Trésor — gels",
  manual: "Manuel",
  fixture: "Fixture",
};

export default async function SourcesTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  const { sources } = detail;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Sources & provenance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Traçabilité des données : chaque source consultée pour construire ce
        dossier.
      </p>

      {sources.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={FileText}
            title="Aucune source consultée"
            description="Ce dossier est en brouillon. Lance un enrichissement pour récupérer Sirene, BODACC et les autres sources, et constituer la chaîne de preuve."
          />
        </div>
      ) : (
      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Source</TableHead>
              <TableHead>Point d&apos;accès</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Origine</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s, i) => (
              <TableRow key={`${s.source}-${i}`} className="hover:bg-transparent">
                <TableCell className="font-medium">
                  {SOURCE_LABELS[s.source] ?? s.source}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {s.endpoint}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.httpStatus === 0 ? "—" : s.httpStatus}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {s.isFixture ? "Démonstration" : "Live"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
