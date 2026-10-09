import type { Scenario } from "@/lib/learning/schema";
import {
  DEPENDENCY_GROUP_LABELS,
  RELATION_KIND_LABELS,
  dependenciesAt,
  objectLabel,
  validityLabel,
  type DependencyGroup,
  type ScenarioState,
} from "@/lib/learning/projections";
import type { Selection } from "./ScenarioGraph";

const pctFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Dépendances de l'entreprise : chaque ratio avec ses entrées, sa période et son périmètre. */
export function DependenciesView({
  scenario,
  state,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  onSelect: (s: Selection) => void;
}) {
  const deps = dependenciesAt(scenario, state);
  const groups = (Object.keys(DEPENDENCY_GROUP_LABELS) as DependencyGroup[]).filter((g) =>
    deps.some((d) => d.group === g),
  );
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Une dépendance décrit une vulnérabilité de l'entreprise, pas une intention du partenaire. On ne les additionne
        pas dans un score.
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune dépendance documentée à cette étape.</p>
      ) : null}
      {groups.map((g) => (
        <section key={g} aria-label={`Dépendance ${DEPENDENCY_GROUP_LABELS[g].toLowerCase()}`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {DEPENDENCY_GROUP_LABELS[g]}
          </h4>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {deps
              .filter((d) => d.group === g)
              .map((d) => (
                <li key={d.relation.id} className="rounded-md border border-border p-3">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold underline decoration-border underline-offset-2 hover:decoration-violet"
                    onClick={() => onSelect({ type: "relation", id: d.relation.id })}
                  >
                    {objectLabel(scenario, d.counterpartId)}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {RELATION_KIND_LABELS[d.relation.kind]}
                    {d.relation.label ? `, ${d.relation.label}` : ""} · {validityLabel(d.relation)}
                  </p>
                  {d.ratio ? (
                    <div className="mt-2 rounded bg-surface-2 p-2 text-sm">
                      <p className="font-semibold tabular-nums">
                        {d.ratio.numerator} / {d.ratio.denominator} = {pctFmt.format(d.ratio.pct)} %
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.ratio.period} · {d.ratio.scope}
                      </p>
                    </div>
                  ) : null}
                  {d.relation.rights ? <p className="mt-2 text-sm leading-6">{d.relation.rights}</p> : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
