import { Eye, EyeOff } from "lucide-react";
import type { Scenario } from "@/lib/learning/schema";
import { LAYER_LABELS, frDate, type ScenarioState } from "@/lib/learning/projections";
import type { Selection } from "./ScenarioGraph";

/**
 * Perspectives (cadrage §4.5) : ce que voit chaque observateur, et ce qu'il ne
 * voit pas. C'est une simulation de connaissance ; dans un outil réel, la
 * visibilité serait imposée par le serveur selon les droits.
 */
export function PerspectivesView({
  scenario,
  state,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  onSelect: (s: Selection) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Personne ne voit tout le parcours. Le graphe rassemble des pièces que chaque observateur, seul, n'aurait pas.
      </p>
      {state.events.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Opérations visibles par observateur</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 font-medium">Opération</th>
                {scenario.observers.map((o) => (
                  <th key={o.id} scope="col" className="py-2 pr-3 font-medium">
                    {o.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.events.map((ev) => (
                <tr key={ev.id} className="border-b border-border/60 align-top">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    <button
                      type="button"
                      className="text-left underline decoration-border underline-offset-2 hover:decoration-violet"
                      onClick={() => onSelect({ type: "event", id: ev.id })}
                    >
                      {ev.label}
                    </button>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {frDate(ev.occurredOn)} · {LAYER_LABELS[ev.layer]}
                    </span>
                  </th>
                  {scenario.observers.map((o) =>
                    ev.visibleTo.includes(o.id) ? (
                      <td key={o.id} className="py-2 pr-3">
                        <span className="inline-flex items-center gap-1">
                          <Eye size={13} aria-hidden /> Voit
                        </span>
                      </td>
                    ) : (
                      <td key={o.id} className="py-2 pr-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <EyeOff size={13} aria-hidden /> Ne voit pas
                        </span>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune opération n'est documentée à cette étape.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {scenario.observers.map((o) => (
          <li key={o.id} className="rounded-md border border-border p-3">
            <p className="text-sm font-semibold">{o.label}</p>
            <p className="mt-1 text-sm leading-6">{o.sees}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              <span className="font-semibold">Limite : </span>
              {o.limit}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Changer de perspective est une simulation pédagogique. Dans un outil réel, chacun ne verrait que ce que ses droits
        permettent, contrôlé par le serveur.
      </p>
    </div>
  );
}
