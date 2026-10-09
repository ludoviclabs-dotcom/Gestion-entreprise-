import { Download } from "lucide-react";
import type { Claim, Scenario } from "@/lib/learning/schema";
import { CLAIM_NATURE_LABELS } from "@/lib/learning/labels";
import type { ScenarioState } from "@/lib/learning/projections";
import { ClaimItem } from "./ClaimItem";

const ORDER: Claim["nature"][] = ["fait_documente", "allegation", "hypothese", "information_manquante"];

/**
 * Carnet d'analyse : toutes les affirmations connues, rangées par statut. Il
 * vit en mémoire ; l'export Markdown est explicite et porte la mention fictive.
 */
export function Notebook({
  scenario,
  state,
  onExport,
}: {
  scenario: Scenario;
  state: ScenarioState;
  onExport: () => void;
}) {
  const known = scenario.claims.filter((c) => state.claimIds.has(c.id));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {known.length} affirmations connues. Rien n'est enregistré hors de cette page.
        </p>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          <Download size={13} aria-hidden /> Exporter le carnet (.md)
        </button>
      </div>
      <div className="mt-3 space-y-4">
        {ORDER.map((nature) => {
          const claims = known.filter((c) => c.nature === nature);
          if (claims.length === 0) return null;
          return (
            <section key={nature} aria-label={CLAIM_NATURE_LABELS[nature].label}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CLAIM_NATURE_LABELS[nature].label} ({claims.length})
              </h4>
              <ul className="mt-2 space-y-2.5">
                {claims.map((c) => (
                  <ClaimItem key={c.id} scenario={scenario} claim={c} resolution={state.resolutions.get(c.id)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
