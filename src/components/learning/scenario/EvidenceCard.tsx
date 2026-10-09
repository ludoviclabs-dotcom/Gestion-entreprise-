import { FileText } from "lucide-react";
import type { Evidence, Scenario } from "@/lib/learning/schema";
import { frDate, type ScenarioState } from "@/lib/learning/projections";
import { NatureBadge } from "./ClaimItem";

/** Pièce du dossier : titre, date, extrait, et les affirmations qu'elle appuie. */
export function EvidenceCard({
  scenario,
  state,
  evidence,
}: {
  scenario: Scenario;
  state: ScenarioState;
  evidence: Evidence;
}) {
  const claims = scenario.claims.filter((c) => state.claimIds.has(c.id) && c.evidenceIds.includes(evidence.id));
  return (
    <article className="rounded-md border border-border bg-background/40 p-3" aria-label={`Pièce : ${evidence.title}`}>
      <header className="flex items-start gap-2">
        <FileText size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-5">{evidence.title}</h4>
          <p className="text-[11px] text-muted-foreground">
            {evidence.date ? `${frDate(evidence.date)} · ` : ""}Pièce fictive
          </p>
        </div>
      </header>
      <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm leading-6 text-foreground">
        {evidence.excerpt}
      </blockquote>
      {claims.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-1.5 text-xs leading-5 text-muted-foreground">
              <NatureBadge nature={c.nature} />
              <span className="min-w-0 flex-1">{c.statement}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
