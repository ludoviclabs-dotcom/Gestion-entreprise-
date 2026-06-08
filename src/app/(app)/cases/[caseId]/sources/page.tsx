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
import EmptyState from "@/components/empty/EmptyState";
import type { SourceKind } from "@/lib/graph/source";

const SOURCE_LABELS: Record<SourceKind, string> = {
  sirene: "INSEE Sirene",
  bodacc: "BODACC",
  inpi: "INPI / RNE",
  tresor_gels: "DG Tresor - gels",
  opensanctions: "OpenSanctions",
  manual: "Manuel",
  fixture: "Fixture",
};

const SUBJECT_LABELS = {
  entity: "Entite",
  edge: "Lien",
  event: "Evenement",
  risk_signal: "Signal",
};

export default async function SourcesTab(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  const detail = await getCasesRepository().getCase(caseId);
  if (!detail) notFound();

  const { sources, evidence } = detail;
  const sourceHealth = getSourceHealth(sources);
  const scoreStatus = getScoreStatus(detail.bundle.case.scores ?? {});

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
        Sources & provenance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Traçabilité des données : chaque source consultée pour construire ce
        dossier.
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
        <div className="mt-8 overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sujet</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Extrait</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence.slice(0, 60).map((item, index) => (
                <TableRow
                  key={`${item.subjectType}-${item.subjectId}-${index}`}
                  className="hover:bg-transparent"
                >
                  <TableCell className="text-muted-foreground">
                    {SUBJECT_LABELS[item.subjectType]}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.source ? SOURCE_LABELS[item.source] : "Non liee"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground"
                    >
                      {item.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                    {item.excerpt ?? item.sourceRecordId ?? "Pointeur conserve"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
