import { CONN_TONE, GLOBAL_SOURCES, TONE_COLOR } from "./mock-data";

/** Section « Sources » : aperçu global des sources connectées. */
export default function GlobalSourcesPanel() {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      {GLOBAL_SOURCES.map((s, i) => {
        const color = TONE_COLOR[CONN_TONE[s.state]];
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--kyb-line)] bg-white/[0.02] px-3 py-2"
          >
            <span className="min-w-0 truncate text-[12px] text-[var(--kyb-text-hi)]">
              {s.name}
            </span>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px]"
              style={{ color }}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${s.state === "connected" ? "kyb-pulse" : ""}`}
                style={{ color, backgroundColor: color }}
              />
              {s.detail}
            </span>
          </div>
        );
      })}
    </div>
  );
}
