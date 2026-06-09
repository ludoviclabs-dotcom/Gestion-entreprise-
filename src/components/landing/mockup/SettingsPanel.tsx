import { SETTINGS } from "./mock-data";

/** Section « Paramètres » : réglages de démonstration (visuels). */
export default function SettingsPanel() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      {SETTINGS.map((s, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
        >
          <div className="min-w-0">
            <div className="text-[12px] text-[var(--kyb-text-hi)]">{s.label}</div>
            <div className="text-[10.5px] text-[var(--kyb-text-mid)]">{s.desc}</div>
          </div>
          <span
            aria-hidden
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
              s.enabled ? "bg-[var(--kyb-violet)]" : "bg-[var(--kyb-line)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                s.enabled ? "left-3.5" : "left-0.5"
              }`}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
