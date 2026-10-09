import type { Relation, Scenario } from "@/lib/learning/schema";
import { RESOURCE_KIND_LABELS } from "@/lib/learning/labels";
import { assetsAt, objectLabel, validityLabel, type ScenarioState } from "@/lib/learning/projections";
import type { Selection } from "./ScenarioGraph";

function RightsRow({
  title,
  empty,
  relations,
  counterpart,
  onSelect,
}: {
  title: string;
  empty: string;
  relations: Relation[];
  counterpart: (r: Relation) => string;
  onSelect: (s: Selection) => void;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-t border-border/60 py-2 text-sm">
      <dt className="text-xs font-medium text-muted-foreground">{title}</dt>
      <dd>
        {relations.length === 0 ? (
          <span className="text-muted-foreground">{empty}</span>
        ) : (
          <ul className="space-y-1.5">
            {relations.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="text-left font-medium underline decoration-border underline-offset-2 hover:decoration-violet"
                  onClick={() => onSelect({ type: "relation", id: r.id })}
                >
                  {counterpart(r)}
                </button>
                {r.rights ? <span className="block text-xs leading-5 text-muted-foreground">{r.rights}</span> : null}
                <span className="block text-xs text-muted-foreground">{validityLabel(r)}</span>
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

/** Actifs stratégiques : titulaire, licences, sûretés et accès, sans jamais les confondre. */
export function AssetsView({
  scenario,
  state,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  onSelect: (s: Selection) => void;
}) {
  const assets = assetsAt(scenario, state);
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Être titulaire, exploiter sous licence, détenir une sûreté et avoir accès sont quatre droits différents.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {assets.map((a) => (
          <article key={a.resource.id} className="rounded-md border border-border p-3">
            <header className="mb-1">
              <button
                type="button"
                className="text-left text-sm font-semibold underline decoration-border underline-offset-2 hover:decoration-violet"
                onClick={() => onSelect({ type: "object", id: a.resource.id })}
              >
                {a.resource.label}
              </button>
              <p className="text-xs text-muted-foreground">{RESOURCE_KIND_LABELS[a.resource.kind]}</p>
            </header>
            <dl>
              <div className="grid grid-cols-[6.5rem_1fr] gap-2 border-t border-border/60 py-2 text-sm">
                <dt className="text-xs font-medium text-muted-foreground">Titulaire</dt>
                <dd>
                  {a.holderIds.length ? a.holderIds.map((id) => objectLabel(scenario, id)).join(", ") : (
                    <span className="text-muted-foreground">Non documenté</span>
                  )}
                </dd>
              </div>
              <RightsRow title="Licences" empty="Aucune connue" relations={a.licences} counterpart={(r) => objectLabel(scenario, r.target)} onSelect={onSelect} />
              <RightsRow title="Sûretés" empty="Aucune connue" relations={a.suretes} counterpart={(r) => objectLabel(scenario, r.source)} onSelect={onSelect} />
              <RightsRow title="Accès" empty="Aucun accès externe connu" relations={a.acces} counterpart={(r) => objectLabel(scenario, r.source)} onSelect={onSelect} />
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
