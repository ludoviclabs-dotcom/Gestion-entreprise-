import type { ComplexiteExplanation } from "@/lib/risk/engine";

/**
 * Décomposition du score de complexité (densité / nb entités / degré max),
 * chaque composante avec son apport en points. Rend le score traçable au graphe.
 * Composant serveur.
 */
export default function ComplexiteBreakdown({
  explanation,
  id,
}: {
  explanation: ComplexiteExplanation;
  id?: string;
}) {
  if (explanation.components.length === 0) return null;
  const max = Math.max(...explanation.components.map((c) => c.points), 1);

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-xl border border-border bg-surface p-5"
    >
      <details open>
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
            Composition du score de complexité
          </h3>
          <span className="text-sm font-semibold tabular-nums">
            {explanation.score}
            <span className="text-xs text-muted-foreground"> / 100</span>
          </span>
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Densité du réseau + nombre d&apos;entités + degré maximal
          {explanation.capped ? " (plafonné à 100)" : ""}. Indicateur structurel
          du dossier, pas un score de risque en soi.
        </p>

        <ul className="mt-4 space-y-2">
          {explanation.components.map((c) => (
            <li key={c.label} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {c.label} — {c.detail}
                  </span>
                  <span className="shrink-0 text-xs font-medium tabular-nums">
                    +{c.points.toLocaleString("fr-FR")} pts
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-violet"
                    style={{ width: `${(c.points / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
