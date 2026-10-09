import type { Scenario } from "@/lib/learning/schema";
import {
  LAYER_LABELS,
  frDate,
  frPct,
  legAmount,
  movementLegs,
  ownershipHistory,
  timelineAt,
  type ScenarioState,
} from "@/lib/learning/projections";

const CONTROL_SHORT = {
  majorite: "majorité",
  presomption: "contrôle présumé",
  aucun: "",
} as const;

/**
 * Chronologie comparée : l'actionnariat à chaque date jouée (s'il y a un
 * actionnariat), puis opérations et pièces dans l'ordre. Une opération indique
 * aussi l'étape où elle est devenue connue.
 */
export function TimelineView({
  scenario,
  state,
}: {
  scenario: Scenario;
  state: ScenarioState;
}) {
  const columns = ownershipHistory(scenario, state.stepIndex);
  const holderIds = [
    ...new Set(columns.flatMap((c) => c.holders.map((h) => h.actor.id))),
  ];
  const entries = timelineAt(scenario, state);
  const hasOwnership = holderIds.length > 0;
  return (
    <div className="space-y-6">
      {hasOwnership ? (
        <section aria-labelledby="actionnariat-compare">
          <h4
            id="actionnariat-compare"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Actionnariat comparé (capital et votes)
          </h4>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Détenteur
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.marker}
                      scope="col"
                      className="py-2 pr-3 font-medium"
                    >
                      {c.marker}
                      <span className="block font-normal">
                        {frDate(c.asOf)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holderIds.map((id) => {
                  const name =
                    scenario.actors.find((a) => a.id === id)?.name ?? id;
                  return (
                    <tr
                      key={id}
                      className="border-b border-border/60 align-top"
                    >
                      <th scope="row" className="py-2 pr-3 font-medium">
                        {name}
                      </th>
                      {columns.map((c, i) => {
                        const h = c.holders.find((x) => x.actor.id === id);
                        const prev =
                          i > 0
                            ? columns[i - 1].holders.find(
                                (x) => x.actor.id === id,
                              )
                            : undefined;
                        const changed =
                          i > 0 && prev?.capitalPct !== h?.capitalPct;
                        return (
                          <td
                            key={c.marker}
                            className={`py-2 pr-3 tabular-nums ${changed ? "font-semibold" : ""}`}
                          >
                            {h ? frPct(h.capitalPct) : "—"}
                            {h && CONTROL_SHORT[h.control] ? (
                              <span className="block text-xs font-normal text-muted-foreground">
                                {CONTROL_SHORT[h.control]}
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            En gras : la valeur a changé depuis la date précédente.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="pieces-chrono">
        <h4
          id="pieces-chrono"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {state.events.length
            ? "Opérations et pièces, par date"
            : "Pièces au dossier, par date"}
        </h4>
        <ol className="mt-2 space-y-0 border-l border-border">
          {entries.map((e) =>
            e.type === "marker" ? (
              <li key={`m-${e.marker}`} className="relative py-1.5 pl-4">
                <span
                  className="absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full bg-teal"
                  aria-hidden
                />
                <span className="text-xs font-semibold text-foreground">
                  {e.marker} · {frDate(e.date)} · {e.title}
                </span>
              </li>
            ) : e.type === "event" ? (
              <li key={`e-${e.event.id}`} className="relative py-1.5 pl-4">
                <span
                  className="absolute -left-[4px] top-3 h-2 w-2 rotate-45 bg-orange-500"
                  aria-hidden
                />
                <span className="text-xs text-muted-foreground">
                  {frDate(e.date)}
                </span>{" "}
                <span className="text-sm font-medium">{e.event.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {movementLegs(e.event).map(legAmount).join(" ; ")} ·{" "}
                  {LAYER_LABELS[e.event.layer]}
                  {e.knownAt ? ` · connue à l'étape « ${e.knownAt} »` : ""}
                </span>
              </li>
            ) : (
              <li key={e.evidence.id} className="relative py-1.5 pl-4">
                <span
                  className="absolute -left-[3px] top-3 h-1.5 w-1.5 rounded-full bg-muted-foreground"
                  aria-hidden
                />
                <span className="text-xs text-muted-foreground">
                  {frDate(e.date)}
                </span>{" "}
                <span className="text-sm">{e.evidence.title}</span>
              </li>
            ),
          )}
        </ol>
      </section>
    </div>
  );
}
