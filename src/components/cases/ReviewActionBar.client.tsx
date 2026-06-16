"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { transitionReviewAction } from "@/app/(app)/cases/actions";
import {
  REVIEW_TRANSITIONS,
  REVIEW_OUTCOME_LABELS,
  REVIEW_OUTCOMES,
  REVIEW_STATE_LABELS,
  type ReviewState,
  type ReviewOutcome,
} from "@/lib/audit/journal";

const BTN =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs transition hover:border-primary/50 disabled:opacity-50";

/**
 * Barre d'actions de revue (P4). Propose UNIQUEMENT les transitions autorisées
 * depuis l'état courant. Conclure ouvre un choix d'issue ; en vigilance haute,
 * une note de justification est obligatoire (garde humaine — jamais automatique).
 */
export default function ReviewActionBar({
  caseId,
  state,
  highBand,
}: {
  caseId: string;
  state: ReviewState;
  highBand: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [concluding, setConcluding] = useState(false);
  const [outcome, setOutcome] = useState<ReviewOutcome>("vigilance_standard");
  const [note, setNote] = useState("");

  const run = (
    to: ReviewState,
    opts?: { note?: string; outcome?: ReviewOutcome },
  ) =>
    start(async () => {
      const res = await transitionReviewAction(caseId, to, opts);
      if (res.ok) {
        toast.success(`Revue — ${REVIEW_STATE_LABELS[to]}`);
        setConcluding(false);
        setNote("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  const targets = REVIEW_TRANSITIONS[state];
  const labelFor = (to: ReviewState) => {
    if (to === "en_revue")
      return state === "a_trier" ? "Ouvrir la revue (EDD)" : "Rouvrir la revue";
    if (to === "a_trier") return "Remettre à trier";
    return "Conclure";
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {targets.map((to) =>
        to === "conclu" ? (
          <button
            key={to}
            type="button"
            disabled={pending}
            className={`${BTN} ${concluding ? "border-primary text-primary" : ""}`}
            onClick={() => setConcluding((v) => !v)}
          >
            Conclure…
          </button>
        ) : (
          <button
            key={to}
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() => run(to)}
          >
            {labelFor(to)}
          </button>
        ),
      )}

      {concluding ? (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2">
          <label className="text-xs text-muted-foreground">Conclusion :</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ReviewOutcome)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {REVIEW_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {REVIEW_OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
          {highBand ? (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note de justification (requise — vigilance élevée)"
              className="min-w-[260px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          ) : null}
          <button
            type="button"
            disabled={pending}
            className={`${BTN} border-primary/50 bg-primary/10`}
            onClick={() => run("conclu", { outcome, note })}
          >
            Valider la conclusion
          </button>
        </div>
      ) : null}
    </div>
  );
}
