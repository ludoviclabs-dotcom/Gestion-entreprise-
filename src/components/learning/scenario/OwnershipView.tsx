import { ExternalLink } from "lucide-react";
import type { Scenario } from "@/lib/learning/schema";
import {
  frDate,
  frPct,
  ownershipAt,
  type HolderQualification,
  type ScenarioState,
} from "@/lib/learning/projections";
import type { UboControl } from "@/lib/graph/ubo";
import { ClaimItem } from "./ClaimItem";
import type { Selection } from "./ScenarioGraph";

const CONTROL_LABELS: Record<UboControl, string> = {
  majorite: "Majorité des votes",
  presomption: "Présumé (L. 233-3 II)",
  aucun: "Non",
};

const QUALIFICATION: Record<HolderQualification, { label: string; className: string }> = {
  beneficiaire: { label: "Bénéficiaire effectif", className: "border-emerald/50 bg-emerald/10" },
  a_examiner: { label: "À examiner", className: "border-amber/60 bg-amber/10" },
  sous_le_seuil: { label: "Sous le seuil", className: "border-border" },
  personne_morale: { label: "Personne morale ou groupe", className: "border-dashed border-muted-foreground/60" },
};

const BAR_COLORS = ["#0ea5a3", "#6366f1", "#94a3b8", "#f472b6", "#84cc16"];

/** Propriété et gouvernance à la date de l'étape : capital, votes, contrôle et qualification, séparément. */
export function OwnershipView({
  scenario,
  state,
  onSelect,
}: {
  scenario: Scenario;
  state: ScenarioState;
  onSelect: (s: Selection) => void;
}) {
  const own = ownershipAt(scenario, state);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6">
        {own.asOf ? <>Référentiel appliqué au {frDate(own.asOf)} : </> : <>Référentiel : </>}
        <a
          href={own.policy.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium underline decoration-border underline-offset-2 hover:decoration-violet"
        >
          {own.policy.shortLabel}, {own.policy.thresholdLabel}
          <ExternalLink size={12} aria-hidden />
        </a>
        .
        {own.upcoming?.appliesFrom ? (
          <span className="text-muted-foreground">
            {" "}À partir du {frDate(own.upcoming.appliesFrom)} : {own.upcoming.shortLabel}, {own.upcoming.thresholdLabel}.
          </span>
        ) : null}
      </p>

      <div>
        <div className="flex h-7 w-full overflow-hidden rounded-md border border-border" aria-hidden>
          {own.holders.map((h, i) => (
            <div
              key={h.actor.id}
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: `${h.capitalPct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
            >
              {Number(h.capitalPct) >= 12 ? frPct(h.capitalPct) : ""}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          {own.holders.map((h, i) => (
            <span key={h.actor.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
              {h.actor.name}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Détenteurs directs à cette date</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">Détenteur</th>
              <th scope="col" className="py-2 pr-3 font-medium">Capital</th>
              <th scope="col" className="py-2 pr-3 font-medium">Votes</th>
              <th scope="col" className="py-2 pr-3 font-medium">Contrôle</th>
              <th scope="col" className="py-2 font-medium">Qualification</th>
            </tr>
          </thead>
          <tbody>
            {own.holders.map((h) => (
              <tr key={h.actor.id} className="border-b border-border/60 align-top">
                <th scope="row" className="py-2 pr-3 font-medium">
                  <button
                    type="button"
                    className="text-left underline decoration-border underline-offset-2 hover:decoration-violet"
                    onClick={() => onSelect({ type: "object", id: h.actor.id })}
                  >
                    {h.actor.name}
                  </button>
                </th>
                <td className="py-2 pr-3 tabular-nums">{frPct(h.capitalPct)}</td>
                <td className="py-2 pr-3 tabular-nums">{frPct(h.votingPct)}</td>
                <td className="py-2 pr-3">{CONTROL_LABELS[h.control]}</td>
                <td className="py-2">
                  <span className={`inline-block rounded border px-1.5 py-0.5 text-xs ${QUALIFICATION[h.qualification].className}`}>
                    {QUALIFICATION[h.qualification].label}
                  </span>
                  {h.qualification === "personne_morale" ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Ses bénéficiaires effectifs se lisent en remontant sa propre chaîne.
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-xs text-muted-foreground">
              <th scope="row" className="py-2 pr-3 font-medium">Total documenté</th>
              <td className="py-2 pr-3 tabular-nums">{frPct(own.totalCapitalPct)}</td>
              <td className="py-2 pr-3 tabular-nums">{frPct(own.totalVotingPct)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {own.otherControl.length > 0 || own.directors.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {own.otherControl.length > 0 ? (
            <div className="rounded-md border border-border p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Droits de contrôle hors capital
              </h4>
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {own.otherControl.map(({ actor, relation }) => (
                  <li key={relation.id}>
                    <span className="font-medium">{actor.name}</span>, {relation.label} : {relation.rights}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {own.directors.length > 0 ? (
            <div className="rounded-md border border-border p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direction</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {own.directors.map(({ actor, relation }) => (
                  <li key={relation.id}>
                    {actor.name}, {relation.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {own.holders.some((h) => h.missing.length > 0) ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ce qui manque au dossier</h4>
          <ul className="mt-2 space-y-2">
            {own.holders.flatMap((h) =>
              h.missing.map((c) => <ClaimItem key={c.id} scenario={scenario} claim={c} showVerification={false} />),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
