import { Badge } from "@/components/ui/badge";
import type { CaseStatus } from "@/lib/data/types";

const CONFIG: Record<CaseStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "#8aa0bd" },
  enriching: { label: "Enrichissement", color: "#f59e0b" },
  ready: { label: "Prêt", color: "#10b981" },
  error: { label: "Erreur", color: "#ef4444" },
};

export default function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const { label, color } = CONFIG[status];
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-border"
      style={{ color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </Badge>
  );
}
