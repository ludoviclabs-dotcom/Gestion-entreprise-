import type { QualitePreuveExplanation } from "@/lib/risk/engine";
import { EVIDENCE_LABELS } from "@/lib/graph/graph-types";

/**
 * Décomposition du score de qualité de preuve : répartition des éléments par
 * niveau de preuve et part « solide » (confirmé | déclaré). Composant serveur.
 */
export default function QualitePreuveBreakdown({
  explanation,
  id,
}: {
  explanation: QualitePreuveExplanation;
  id?: string;
}) {
  if (explanation.total === 0) return null;

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-5"
    >
      <details open>
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
            Composition du score de qualité de preuve
          </h3>
          <span className="text-sm font-semibold tabular-nums">
            {explanation.score}
            <span className="text-xs text-muted-foreground"> / 100</span>
          </span>
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Part des éléments « confirmé » ou « déclaré » sur {explanation.total}{" "}
          (nœuds + liens + événements) — {explanation.solid} solides. Une preuve
          inférée ou simulée est une hypothèse, jamais un fait.
        </p>

        <ul className="mt-4 space-y-2">
          {explanation.counts.map((c) => {
            const color = c.solid ? "var(--emerald)" : "var(--amber)";
            return (
              <li key={c.level} className="flex items-center gap-3">
                <span
                  className="w-20 shrink-0 text-xs font-medium"
                  style={{ color }}
                >
                  {EVIDENCE_LABELS[c.level]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.solid ? "solide" : "hypothèse"}
                    </span>
                    <span className="shrink-0 text-xs font-medium tabular-nums">
                      {c.count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.count / explanation.total) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
