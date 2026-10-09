import type { Claim, Scenario } from "@/lib/learning/schema";
import { CLAIM_NATURE_LABELS, VERIFICATION_LABELS } from "@/lib/learning/labels";
import { claimById, resolutionLabel, type Resolution } from "@/lib/learning/projections";

/** Style par statut : la forme (bordure pleine ou pointillée) double toujours la couleur. */
export const NATURE_STYLES: Record<Claim["nature"], string> = {
  fait_documente: "border-emerald/50 bg-emerald/10 text-emerald-800 dark:text-emerald-300",
  allegation: "border-amber/60 bg-amber/10 text-amber-800 dark:text-amber-300",
  hypothese: "border-dashed border-sky-500/60 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  information_manquante: "border-dashed border-muted-foreground/60 bg-transparent text-muted-foreground",
};

export function NatureBadge({ nature }: { nature: Claim["nature"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${NATURE_STYLES[nature]}`}
    >
      {CLAIM_NATURE_LABELS[nature].label}
    </span>
  );
}

/** Une affirmation, son statut, son niveau de vérification et, le cas échéant, sa résolution. */
export function ClaimItem({
  scenario,
  claim,
  resolution,
  showVerification = true,
}: {
  scenario: Scenario;
  claim: Claim;
  resolution?: Resolution;
  showVerification?: boolean;
}) {
  const by = resolution ? claimById(scenario, resolution.byClaimId) : undefined;
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <NatureBadge nature={claim.nature} />
        {showVerification ? (
          <span className="text-[11px] text-muted-foreground">{VERIFICATION_LABELS[claim.verification]}</span>
        ) : null}
        {resolution ? (
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
            {resolutionLabel(resolution)}
          </span>
        ) : null}
      </div>
      <p className={`text-sm leading-6 ${resolution ? "text-muted-foreground" : ""}`}>{claim.statement}</p>
      {by ? <p className="border-l-2 border-border pl-2 text-xs leading-5 text-muted-foreground">{by.statement}</p> : null}
    </li>
  );
}
