"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SOURCE_LABELS, SUBJECT_LABELS } from "./source-labels";
import type { EvidenceRow, SourceRecordDetail } from "@/lib/data/types";

const MAX_PAYLOAD_CHARS = 200_000;

/** Payload brut pretty-printé, tronqué au-delà de 200 Ko de texte. */
function renderPayload(payload: unknown): { text: string; truncated: boolean } {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  if (text.length <= MAX_PAYLOAD_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_PAYLOAD_CHARS), truncated: true };
}

/**
 * Table des preuves + inspecteur (drawer) : pour chaque ligne d'évidence,
 * affiche la provenance complète — endpoint, niveau, pointeur JSON dans le
 * payload, empreinte SHA-256 et payload brut de l'enregistrement source.
 */
export default function EvidenceExplorer({
  evidence,
  records,
  subjectLabels,
  initialSubjectId,
}: {
  evidence: EvidenceRow[];
  records: SourceRecordDetail[];
  subjectLabels: Record<string, string>;
  initialSubjectId?: string;
}) {
  const rows = evidence.slice(0, 60);
  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    if (!initialSubjectId) return null;
    const index = rows.findIndex((r) => r.subjectId === initialSubjectId);
    return index >= 0 ? index : null;
  });

  const selected = openIndex !== null ? rows[openIndex] : null;
  const record = selected ? recordFor(selected, records) : null;
  const payload = record ? renderPayload(record.payload) : null;

  return (
    <>
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
            {rows.map((item, index) => (
              <TableRow
                key={`${item.subjectType}-${item.subjectId}-${index}`}
                data-testid="evidence-row"
                className="cursor-pointer"
                onClick={() => setOpenIndex(index)}
              >
                <TableCell className="text-muted-foreground">
                  {SUBJECT_LABELS[item.subjectType]}
                  <span className="ml-2 text-xs">
                    {subjectLabels[item.subjectId] ?? ""}
                  </span>
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

      <Sheet
        open={openIndex !== null}
        onOpenChange={(open) => {
          if (!open) setOpenIndex(null);
        }}
      >
        <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Inspecteur de preuve</SheetTitle>
                <SheetDescription>
                  {SUBJECT_LABELS[selected.subjectType]} ·{" "}
                  {subjectLabels[selected.subjectId] ?? selected.subjectId}
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground"
                  >
                    {selected.level}
                  </Badge>
                  <span className="text-sm font-medium">
                    {selected.source
                      ? SOURCE_LABELS[selected.source]
                      : "Source non liee"}
                  </span>
                </div>

                {selected.excerpt ? (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Justification
                    </p>
                    <p className="mt-1 text-sm">{selected.excerpt}</p>
                  </section>
                ) : null}

                {selected.pointer ? (
                  <section>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pointeur (chemin dans le payload)
                    </p>
                    <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-surface-2 p-2 text-xs">
                      {JSON.stringify(selected.pointer, null, 2)}
                    </pre>
                  </section>
                ) : null}

                {record ? (
                  <>
                    <section>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Enregistrement source
                      </p>
                      <dl className="mt-1 space-y-1 text-xs">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Endpoint</dt>
                          <dd className="break-all text-right font-mono">
                            {record.endpoint}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Origine</dt>
                          <dd>{record.isFixture ? "Démonstration" : "Live"}</dd>
                        </div>
                        {record.requestedAt ? (
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">Consultée le</dt>
                            <dd>{record.requestedAt.slice(0, 16).replace("T", " ")} UTC</dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">SHA-256</dt>
                          <dd
                            data-testid="payload-hash"
                            className="break-all text-right font-mono"
                          >
                            {record.payloadHash}
                          </dd>
                        </div>
                      </dl>
                    </section>

                    <section className="flex min-h-0 flex-1 flex-col">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Payload brut{payload?.truncated ? " (tronqué à 200 Ko)" : ""}
                      </p>
                      <ScrollArea className="mt-1 h-72 rounded-lg border border-border bg-surface-2">
                        <pre className="p-2 text-xs">{payload?.text}</pre>
                      </ScrollArea>
                    </section>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Payload brut indisponible pour cette preuve (source non
                    rattachée à un enregistrement).
                  </p>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Enregistrement source correspondant : par id si présent, sinon par kind. */
function recordFor(
  row: EvidenceRow,
  records: SourceRecordDetail[],
): SourceRecordDetail | null {
  if (row.sourceRecordId) {
    const byId = records.find((r) => r.id === row.sourceRecordId);
    if (byId) return byId;
  }
  if (row.source) {
    return records.find((r) => r.source === row.source) ?? null;
  }
  return null;
}
