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
import { getScoreStatus, getSourceHealth } from "@/lib/data/case-quality";
import CaseQualityBadges from "@/components/cases/CaseQualityBadges";
import EvidenceExplorer from "@/components/cases/EvidenceExplorer.client";
import ProofJournal from "@/components/cases/ProofJournal";
import EmptyState from "@/components/empty/EmptyState";
import { SOURCE_LABELS } from "@/components/cases/source-labels";

export default async function SourcesTab(props: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ subject?: string }>;
}) {
  const { caseId } = await props.params;
  const { subject } = await props.searchParams;
  const repository = getCasesRepository();
  const detail = await repository.getCase(caseId);
  if (!detail) notFound();
  const [journal, sourceRecords] = await Promise.all([
    repository.listProofEvents(caseId),
    repository.getSourceRecords(caseId),
  ]);

  const { sources, evidence } = detail;
  const sourceHealth = getSourceHealth(sources);
  const scoreStatus = getScoreStatus(detail.bundle.case.scores ?? {});

  // Libellés des sujets pour l'inspecteur (id → label lisible).
  const subjectLabels: Record<string, string> = {};
  for (const entity of detail.bundle.entities) subjectLabels[entity.id] = entity.label;
  for (const edge of detail.bundle.edges) subjectLabels[edge.id] = edge.label ?? edge.type;
  for (const event of detail.bundle.events) subjectLabels[event.id] = event.title;
  for (const signal of detail.bundle.riskSignals) subjectLabels[signal.id] = signal.ruleId;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Sources & provenance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Traçabilité des données : chaque source consultée pour construire ce
        dossier. Clique une preuve pour inspecter son enregistrement source.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <CaseQualityBadges
          origin={sourceHealth.origin}
          scoreStatus={scoreStatus}
          sourceHealth={sourceHealth}
        />
        <span className="text-xs text-muted-foreground">
          {evidence.length} preuve{evidence.length > 1 ? "s" : ""} reliee
          {evidence.length > 1 ? "s" : ""} aux entites, liens et signaux.
        </span>
      </div>

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

      {evidence.length > 0 ? (
        <EvidenceExplorer
          evidence={evidence}
          records={sourceRecords}
          subjectLabels={subjectLabels}
          initialSubjectId={subject}
        />
      ) : null}

      <ProofJournal events={journal} />
    </div>
  );
}
