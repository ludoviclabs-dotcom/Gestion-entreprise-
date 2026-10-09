import { Info, X } from "lucide-react";
import type { Scenario } from "@/lib/learning/schema";
import { ACTOR_KIND_LABELS, RESOURCE_KIND_LABELS } from "@/lib/learning/labels";
import {
  RELATION_KIND_LABELS,
  evidenceById,
  frAmount,
  frPct,
  knownClaimsAbout,
  knownClaimsOf,
  objectById,
  objectLabel,
  relationShortLabel,
  validityLabel,
  type ScenarioState,
} from "@/lib/learning/projections";
import { ClaimItem } from "./ClaimItem";
import type { Selection } from "./ScenarioGraph";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Fiche de l'objet ou de la relation sélectionnés, avec les affirmations connues et leurs pièces. */
export function Inspector({
  scenario,
  state,
  selection,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  if (!selection) {
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
        Sélectionnez un acteur, un actif ou une relation pour voir ce que les pièces en disent.
      </p>
    );
  }

  const close = (
    <button
      type="button"
      onClick={() => onSelect(null)}
      className="rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      aria-label="Fermer la fiche"
    >
      <X size={15} aria-hidden />
    </button>
  );

  if (selection.type === "relation") {
    const r = state.relations.find((x) => x.id === selection.id);
    if (!r) return null;
    const claims = knownClaimsOf(scenario, state, r);
    const pieces = [...new Set(claims.flatMap((c) => c.evidenceIds))]
      .filter((id) => state.evidenceIds.has(id))
      .map((id) => evidenceById(scenario, id))
      .filter((e) => e !== undefined);
    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {RELATION_KIND_LABELS[r.kind]}
            </p>
            <h3 className="text-base font-semibold">
              {objectLabel(scenario, r.source)} → {objectLabel(scenario, r.target)}
            </h3>
          </div>
          {close}
        </div>
        <dl className="mt-2 divide-y divide-border/60">
          <Row label="Relation">{relationShortLabel(r)}</Row>
          {r.capitalPct ? <Row label="Capital">{frPct(r.capitalPct)}</Row> : null}
          {r.votingPct ? <Row label="Votes">{frPct(r.votingPct)}</Row> : null}
          {r.rights ? <Row label="Droits, périmètre">{r.rights}</Row> : null}
          {r.measure ? (
            <Row label="Mesure">
              {frAmount(r.measure.numerator.value, r.measure.numerator.unit)} sur{" "}
              {frAmount(r.measure.denominator.value, r.measure.denominator.unit)}, {r.measure.period}
              <span className="block text-xs text-muted-foreground">{r.measure.scope}</span>
            </Row>
          ) : null}
          <Row label="Validité">{validityLabel(r)}</Row>
        </dl>
        <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ce qui l'établit</h4>
        <ul className="mt-2 space-y-2">
          {claims.map((c) => (
            <ClaimItem key={c.id} scenario={scenario} claim={c} resolution={state.resolutions.get(c.id)} />
          ))}
        </ul>
        {pieces.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Pièces : {pieces.map((p) => p.title).join(" ; ")}.</p>
        ) : null}
      </div>
    );
  }

  const o = objectById(scenario, selection.id);
  if (!o || !state.objectIds.includes(selection.id)) return null;
  const relations = state.relations.filter((r) => r.source === selection.id || r.target === selection.id);
  const claims = knownClaimsAbout(scenario, state, selection.id);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {o.type === "actor" ? ACTOR_KIND_LABELS[o.actor.kind] : RESOURCE_KIND_LABELS[o.resource.kind]}
          </p>
          <h3 className="text-base font-semibold">{o.type === "actor" ? o.actor.name : o.resource.label}</h3>
        </div>
        {close}
      </div>
      <dl className="mt-2 divide-y divide-border/60">
        {o.type === "actor" && o.actor.roles.length ? <Row label="Rôles">{o.actor.roles.join(", ")}</Row> : null}
        {o.type === "actor" && o.actor.country ? (
          <Row label="Établissement">
            {o.actor.country}
            <span className="block text-xs text-muted-foreground">
              Une information de contexte, jamais un indice d'intention.
            </span>
          </Row>
        ) : null}
        {o.type === "resource" && o.resource.identifier ? (
          <Row label="Identifiant">{o.resource.identifier}</Row>
        ) : null}
      </dl>
      {relations.length > 0 ? (
        <>
          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Relations à cette date
          </h4>
          <ul className="mt-1.5 space-y-1 text-sm">
            {relations.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="text-left underline decoration-border underline-offset-2 hover:decoration-violet"
                  onClick={() => onSelect({ type: "relation", id: r.id })}
                >
                  {RELATION_KIND_LABELS[r.kind]} : {objectLabel(scenario, r.source)} → {objectLabel(scenario, r.target)}
                </button>
                <span className="text-muted-foreground"> ({relationShortLabel(r)})</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {claims.length > 0 ? (
        <>
          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ce que l'on sait, et ce qui manque
          </h4>
          <ul className="mt-2 space-y-2">
            {claims.map((c) => (
              <ClaimItem key={c.id} scenario={scenario} claim={c} resolution={state.resolutions.get(c.id)} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
