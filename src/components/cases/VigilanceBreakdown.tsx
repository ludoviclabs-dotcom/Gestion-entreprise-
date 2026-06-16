import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/graph/graph-types";
import type { FaisceauResult, VigilanceExplanation } from "@/lib/risk/engine";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";

/**
 * Décomposition explicable du score de vigilance : chaque signal et sa
 * contribution en points. Rend le score auditable (motivation des décisions
 * de vigilance) au lieu d'un chiffre opaque. Composant serveur.
 *
 * Le `faisceau` (optionnel) rappelle qu'un signal isolé n'est jamais une alerte
 * (§7.3) — statut qualitatif, n'altère pas le score.
 */
export default function VigilanceBreakdown({
  explanation,
  faisceau,
}: {
  explanation: VigilanceExplanation;
  faisceau?: FaisceauResult;
}) {
  if (explanation.contributions.length === 0) return null;
  const max = Math.max(...explanation.contributions.map((c) => c.points), 1);

  return (
    <section
      id="score-vigilance"
      className="scroll-mt-24 rounded-xl border border-border bg-surface p-5"
    >
      <details open>
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
            Composition du score de{" "}
            <GlossaryTerm id="vigilance">vigilance</GlossaryTerm>
          </h3>
          <span className="text-sm font-semibold tabular-nums">
            {explanation.score}
            <span className="text-xs text-muted-foreground"> / 100</span>
          </span>
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Somme pondérée des signaux déclenchés
          {explanation.capped ? " (plafonnée à 100)" : ""}.
        </p>
        {faisceau ? (
          <p
            className="mt-3 rounded-lg border px-3 py-2 text-xs"
            style={
              faisceau.converged
                ? {
                    borderColor: `${SEVERITY_COLORS.medium}66`,
                    background: `${SEVERITY_COLORS.medium}14`,
                  }
                : { borderColor: "var(--border)" }
            }
          >
            <span className="font-medium">
              <GlossaryTerm id="faisceau">Faisceau d&apos;indices</GlossaryTerm>{" "}
              :{" "}
            </span>
            {faisceau.converged
              ? `constitué — ${faisceau.distinctFamilies} familles d'indices convergentes sur ${faisceau.distinctSubjects} entité(s) (seuil ${faisceau.k}). À qualifier humainement.`
              : faisceau.materialCount === 0
                ? "aucun signal matériel — rien à escalader."
                : `${faisceau.distinctFamilies}/${faisceau.k} famille${faisceau.distinctFamilies > 1 ? "s" : ""} d'indices — non concluant à lui seul.`}
          </p>
        ) : null}

        <ul className="mt-4 space-y-2">
        {explanation.contributions.map((c, i) => (
          <li key={`${c.ruleId}-${i}`} className="flex items-center gap-3">
            <span
              className="w-16 shrink-0 rounded px-2 py-0.5 text-center text-[10px] font-semibold uppercase"
              style={{
                background: `${SEVERITY_COLORS[c.severity]}22`,
                color: SEVERITY_COLORS[c.severity],
              }}
            >
              {SEVERITY_LABELS[c.severity]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">
                  règle {c.ruleId}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums">
                  +{c.points.toLocaleString("fr-FR")} pts
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.points / max) * 100}%`,
                    backgroundColor: SEVERITY_COLORS[c.severity],
                  }}
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
