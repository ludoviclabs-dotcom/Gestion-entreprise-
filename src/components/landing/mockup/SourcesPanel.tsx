import StatusBadge from "./StatusBadge";
import { SOURCE_DETAILS } from "./mock-data";

/** Onglet « Sources » : registres avec fraîcheur / fiabilité / vérification. */
export default function SourcesPanel() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      {SOURCE_DETAILS.map((s, i) => (
        <div
          key={i}
          className="rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-[12px] font-medium text-[var(--kyb-text-hi)]">
              {s.name}
            </span>
            <StatusBadge label={s.badge} tone={s.tone} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-[var(--kyb-text-mid)]">
            <span>Fraîcheur : {s.freshness}</span>
            <span>Fiabilité : {s.reliability}</span>
            <span>Vérifié : {s.lastCheck}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
