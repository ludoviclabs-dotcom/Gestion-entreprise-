"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { transitionReviewAction } from "@/app/(app)/cases/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HEADER_LINK, HEADER_PRIMARY } from "./header-styles";
import {
  REVIEW_TRANSITIONS,
  REVIEW_OUTCOME_LABELS,
  REVIEW_OUTCOMES,
  REVIEW_STATE_LABELS,
  type ReviewState,
  type ReviewOutcome,
} from "@/lib/audit/journal";

/**
 * Actions de revue (P4) de l'en-tête du dossier. Propose UNIQUEMENT les
 * transitions autorisées depuis l'état courant : la première est l'action
 * principale. Conclure ouvre un choix d'issue ; une note de justification est
 * exigée en vigilance haute ou pour une vigilance renforcée (garde humaine —
 * jamais automatique, même règle que le serveur).
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
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const needNote = highBand || outcome === "vigilance_renforcee";

  useEffect(() => {
    if (!concluding) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setConcluding(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConcluding(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [concluding]);

  const run = (to: ReviewState, opts?: { note?: string; outcome?: ReviewOutcome }) =>
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

  const labelFor = (to: ReviewState) => {
    if (to === "en_revue") return state === "a_trier" ? "Ouvrir la revue (EDD)" : "Rouvrir la revue";
    if (to === "a_trier") return "Remettre à trier";
    return "Conclure…";
  };

  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-x-[22px] gap-y-3">
      {REVIEW_TRANSITIONS[state].map((to, i) => {
        const primary = i === 0;
        const conclude = to === "conclu";
        return (
          <button
            key={to}
            type="button"
            disabled={pending}
            aria-expanded={conclude ? concluding : undefined}
            aria-controls={conclude ? panelId : undefined}
            onClick={() => (conclude ? setConcluding((v) => !v) : run(to))}
            className={cn(primary ? HEADER_PRIMARY : HEADER_LINK, primary && "order-last")}
          >
            <span>{labelFor(to)}</span>
            {primary ? <span aria-hidden>→</span> : null}
          </button>
        );
      })}

      {concluding ? (
        <div
          id={panelId}
          role="group"
          aria-label="Conclure la revue"
          className="motion-reveal absolute right-0 top-full z-[var(--z-overlay)] mt-2 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 rounded-sm bg-surface-3 p-4 shadow-lg"
        >
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-micro uppercase tracking-[0.1em] text-subtle">Conclusion</span>
            <NativeSelect size="sm" value={outcome} onChange={(e) => setOutcome(e.target.value as ReviewOutcome)}>
              {REVIEW_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {REVIEW_OUTCOME_LABELS[o]}
                </option>
              ))}
            </NativeSelect>
          </label>
          {needNote ? (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-micro uppercase tracking-[0.1em] text-subtle">
                Note de justification (requise{highBand ? " — vigilance élevée" : ""})
              </span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="10 caractères minimum" />
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              disabled={pending}
              className={HEADER_PRIMARY}
              onClick={() => run("conclu", { outcome, note })}
            >
              <span>Valider la conclusion</span>
              <span aria-hidden>→</span>
            </button>
            <button type="button" className={HEADER_LINK} onClick={() => setConcluding(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
