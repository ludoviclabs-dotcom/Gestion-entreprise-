import type { CaseEvent } from "@/lib/graph/graph-types";

/**
 * Frise de couverture médiatique (GDELT) — volume d'articles par mois, part
 * défavorable en ambre. Surfaçage pour examen humain (faisceau), jamais une
 * conclusion. Pur SVG/CSS (aucune dépendance). Composant serveur.
 */
const H = 80;

export default function MediaFrise({ events }: { events: CaseEvent[] }) {
  const media = events.filter(
    (e) =>
      e.kind === "couverture_media" || e.kind === "couverture_media_defavorable",
  );
  if (media.length < 2) return null;

  const byMonth = new Map<string, { total: number; adverse: number }>();
  for (const e of media) {
    const month = (e.occurredOn ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const cur = byMonth.get(month) ?? { total: 0, adverse: 0 };
    cur.total += 1;
    if (e.kind === "couverture_media_defavorable") cur.adverse += 1;
    byMonth.set(month, cur);
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (months.length === 0) return null;
  const max = Math.max(...months.map(([, v]) => v.total));
  const adverseTotal = media.filter(
    (e) => e.kind === "couverture_media_defavorable",
  ).length;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
        Couverture médiatique
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {media.length} article(s){adverseTotal > 0 ? `, dont ${adverseTotal} défavorable(s) (ambre)` : ""} — surfaçage pour examen, jamais une conclusion.
      </p>
      <div className="mt-4 flex items-end gap-1.5" style={{ height: H }}>
        {months.map(([month, v]) => {
          const h = Math.max(4, (v.total / max) * H);
          const adverseH = v.total > 0 ? (v.adverse / v.total) * h : 0;
          return (
            <div
              key={month}
              className="flex flex-1 flex-col items-center justify-end gap-1"
              title={`${month} : ${v.total} article(s), ${v.adverse} défavorable(s)`}
            >
              <div
                className="w-full max-w-[1.75rem] overflow-hidden rounded-t"
                style={{ height: h }}
              >
                <div style={{ height: h - adverseH, background: "#94a3b8" }} />
                <div style={{ height: adverseH, background: "#f59e0b" }} />
              </div>
              <span className="text-[9px] text-muted-foreground">
                {month.slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
