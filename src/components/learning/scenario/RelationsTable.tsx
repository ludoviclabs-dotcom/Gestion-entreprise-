import type { Scenario } from "@/lib/learning/schema";
import {
  LAYER_LABELS,
  RELATION_KIND_LABELS,
  frDate,
  legAmount,
  movementLegs,
  knownClaimsOf,
  objectLabel,
  relationShortLabel,
  validityLabel,
  type ScenarioState,
  type StateDiff,
} from "@/lib/learning/projections";
import { NatureBadge } from "./ClaimItem";
import type { Selection } from "./ScenarioGraph";

/** Alternative tabulaire au graphe : mêmes relations, lisibles au clavier et au lecteur d'écran. */
export function RelationsTable({
  scenario,
  state,
  diff,
  selection,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  diff: StateDiff;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const added = new Set(diff.addedRelationIds);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Relations visibles à cette étape</caption>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-3 font-medium">De</th>
            <th scope="col" className="py-2 pr-3 font-medium">Relation</th>
            <th scope="col" className="py-2 pr-3 font-medium">Vers</th>
            <th scope="col" className="py-2 pr-3 font-medium">Validité</th>
            <th scope="col" className="py-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {state.relations.map((r) => {
            const selected = selection?.type === "relation" && selection.id === r.id;
            const natures = [...new Set(knownClaimsOf(scenario, state, r).map((c) => c.nature))];
            return (
              <tr key={r.id} className={`border-b border-border/60 align-top ${selected ? "bg-surface-2" : ""}`}>
                <td className="py-2 pr-3">{objectLabel(scenario, r.source)}</td>
                <td className="py-2 pr-3">
                  <button
                    type="button"
                    className="text-left underline decoration-border underline-offset-2 hover:decoration-violet"
                    aria-pressed={selected}
                    onClick={() => onSelect({ type: "relation", id: r.id })}
                  >
                    {RELATION_KIND_LABELS[r.kind]} : {relationShortLabel(r)}
                  </button>
                  {added.has(r.id) ? (
                    <span className="ml-1.5 rounded bg-teal/15 px-1 text-[11px] font-medium text-foreground">nouveau</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">{objectLabel(scenario, r.target)}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{validityLabel(r)}</td>
                <td className="py-2">
                  <span className="flex flex-wrap gap-1">
                    {natures.map((n) => (
                      <NatureBadge key={n} nature={n} />
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.events.length > 0 ? (
        <table className="mt-5 w-full min-w-[560px] text-left text-sm">
          <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mouvements de valeur
          </caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">Date</th>
              <th scope="col" className="py-2 pr-3 font-medium">Opération</th>
              <th scope="col" className="py-2 pr-3 font-medium">Montants</th>
              <th scope="col" className="py-2 font-medium">Couche</th>
            </tr>
          </thead>
          <tbody>
            {state.events.map((ev) => {
              const selected = selection?.type === "event" && selection.id === ev.id;
              return (
                <tr key={ev.id} className={`border-b border-border/60 align-top ${selected ? "bg-surface-2" : ""}`}>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{frDate(ev.occurredOn)}</td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="text-left underline decoration-border underline-offset-2 hover:decoration-violet"
                      aria-pressed={selected}
                      onClick={() => onSelect({ type: "event", id: ev.id })}
                    >
                      {ev.label}
                    </button>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{movementLegs(ev).map(legAmount).join(" ; ")}</td>
                  <td className="py-2 text-xs text-muted-foreground">{LAYER_LABELS[ev.layer]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {diff.endedRelationIds.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Terminé depuis l'étape précédente :{" "}
          {diff.endedRelationIds
            .map((id) => scenario.relations.find((r) => r.id === id))
            .filter((r) => r !== undefined)
            .map((r) => `${objectLabel(scenario, r.source)}, ${relationShortLabel(r)}, ${objectLabel(scenario, r.target)}`)
            .join(" ; ")}
          .
        </p>
      ) : null}
    </div>
  );
}
