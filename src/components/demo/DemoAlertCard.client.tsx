"use client";

import { AlertTriangle, Info } from "lucide-react";
import type { DemoAlert, DemoAlertSeverity } from "./demo-data";

export type AlertVisibility = "hidden" | "visible" | "leaving";

const SEVERITY_ACCENT: Record<DemoAlertSeverity, string> = {
  warning: "var(--kyb-amber)",
  error: "var(--kyb-red)",
  info: "var(--kyb-violet-soft)",
};

/**
 * Carte d'alerte réglementaire de la démo. `role="alert"` + `aria-live` pour
 * l'annonce par lecteurs d'écran. Deux variantes : tooltip (desktop, ancrée
 * près du nœud déclencheur) et barre du bas (alerte globale + mobile).
 * L'entrée/sortie est pilotée par `visibility` (l'orchestrateur tient l'horloge).
 */
export default function DemoAlertCard({
  alert,
  visibility,
  position,
}: {
  alert: DemoAlert;
  visibility: AlertVisibility;
  position: "tooltip" | "bottom-bar";
}) {
  if (visibility === "hidden") return null;

  const accent = SEVERITY_ACCENT[alert.severity];
  const Icon = alert.severity === "info" ? Info : AlertTriangle;
  const motionClass =
    visibility === "leaving"
      ? "demo-alert-card--leaving"
      : position === "tooltip"
        ? "demo-alert-card--right"
        : "demo-alert-card--bottom";

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`${motionClass} pointer-events-none rounded-md border bg-[#0e1020]/95 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur ${
        position === "tooltip" ? "w-[320px]" : "w-[min(680px,92vw)]"
      }`}
      style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={17} className="mt-0.5 shrink-0" style={{ color: accent }} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--kyb-text-hi)]">{alert.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--kyb-text-mid)]">
            {alert.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alert.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  color: accent,
                }}
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
