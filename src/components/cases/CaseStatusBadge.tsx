import { StatusBadge } from "@/components/ui/status-badge";
import { CASE_STATUS_TONE } from "@/lib/design/domain-tones";
import type { CaseStatus } from "@/lib/data/types";

const LABELS: Record<CaseStatus, string> = {
  draft: "Brouillon",
  enriching: "Enrichissement",
  ready: "Prêt",
  error: "Erreur",
};

export default function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <StatusBadge tone={CASE_STATUS_TONE[status]}>{LABELS[status]}</StatusBadge>;
}
