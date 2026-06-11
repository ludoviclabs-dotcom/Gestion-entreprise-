import { ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { verifyChain } from "@/lib/audit/hash-chain";
import {
  PROOF_EVENT_LABELS,
  summarizeProofEvent,
  type ProofEvent,
} from "@/lib/audit/journal";

/** « 2026-05-28T09:15:00.000Z » → « 2026-05-28 09:15 UTC » (déterministe). */
function formatOccurredAt(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Journal de preuve d'un dossier (Étape 3.4 « audit_logs ») — composant
 * serveur uniquement : la vérification de chaîne utilise node:crypto.
 */
export default function ProofJournal({ events }: { events: ProofEvent[] }) {
  if (events.length === 0) return null;
  const verdict = verifyChain(events);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">
            Journal de preuve
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque action sur le dossier est chaînée par hash (append-only) :
            toute altération a posteriori casse la chaîne.
          </p>
        </div>
        {verdict.ok ? (
          <Badge
            variant="outline"
            className="gap-1 border-border text-muted-foreground"
          >
            <ShieldCheck size={13} aria-hidden />
            Chaîne vérifiée
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert size={13} aria-hidden />
            Chaîne rompue (entrée {verdict.brokenAt + 1})
          </Badge>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-40">Horodatage</TableHead>
              <TableHead>Événement</TableHead>
              <TableHead>Détail</TableHead>
              <TableHead className="text-right">Empreinte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow
                key={`${event.caseId}-${event.seq}`}
                className="hover:bg-transparent"
              >
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatOccurredAt(event.occurredAt)}
                </TableCell>
                <TableCell className="font-medium">
                  {PROOF_EVENT_LABELS[event.kind]}
                </TableCell>
                <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                  {summarizeProofEvent(event)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {event.entryHash.slice(0, 16)}…
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
