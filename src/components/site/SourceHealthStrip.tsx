import { getConnectorStatuses } from "@/lib/connectors/status";
import { isDemoMode } from "@/lib/env";
import { SourceHealthBadge } from "@/components/site/SourceHealthBadge";

/**
 * Bandeau « état des sources » — vérité live/fixture par connecteur, dérivée
 * de getConnectorStatuses(). Cadre honnêtement la démo (« fixtures anonymisées »)
 * pour lever toute ambiguïté « 100 % fictif ».
 *
 * ⚠️ SERVER-ONLY (lit env via status.ts). À rendre depuis un server component.
 */
export function SourceHealthStrip({ className = "" }: { className?: string }) {
  const demo = isDemoMode();
  const statuses = getConnectorStatuses();

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-foreground">
          {demo
            ? "Mode démo — fixtures anonymisées"
            : "Mode live — sources officielles connectées"}
        </p>
        <p className="text-xs text-muted-foreground">
          {demo
            ? "Aucune donnée réelle. Chaque connecteur bascule en live dès l'activation de sa clé."
            : "Les connecteurs interrogent les API officielles en temps réel."}
        </p>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <li
            key={s.key}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5"
          >
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <SourceHealthBadge live={s.live} />
          </li>
        ))}
      </ul>
    </div>
  );
}
