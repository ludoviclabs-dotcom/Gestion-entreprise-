import { CheckCircle2, CircleAlert, CircleHelp } from "lucide-react";
import type { Exercise, Verdict } from "@/lib/learning/schema";
import { canSubmit, gradeExercise, missesRequired, selectionBounds } from "@/lib/learning/projections";

export const VERDICT_STYLES: Record<Verdict, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  juste: { label: "Réponse juste", className: "border-emerald/50 bg-emerald/10", Icon: CheckCircle2 },
  partiel: { label: "Réponse partielle", className: "border-amber/60 bg-amber/10", Icon: CircleHelp },
  faux: { label: "Réponse à revoir", className: "border-red/50 bg-red/10", Icon: CircleAlert },
};

const OPTION_VERDICT: Record<Verdict, string> = { juste: "Juste", partiel: "Partiel", faux: "À revoir" };

function boundsHint(exercise: Exercise): string {
  const [min, max] = selectionBounds(exercise);
  if (!exercise.multiple) return "Une seule réponse.";
  if (max >= exercise.options.length) return `Au moins ${min} réponse${min > 1 ? "s" : ""}.`;
  if (min === max) return `${min} réponses.`;
  return `De ${min} à ${max} réponses.`;
}

/**
 * Exercice d'une étape. Avant validation : choix libres. Après : chaque option
 * choisie reçoit son retour argumenté, et les réponses attendues non choisies
 * sont montrées. Une réponse validée n'est plus modifiable.
 */
export function ExercisePanel({
  exercise,
  draft,
  submitted,
  onChange,
  onSubmit,
}: {
  exercise: Exercise;
  draft: string[];
  submitted?: string[];
  onChange: (ids: string[]) => void;
  onSubmit: () => void;
}) {
  const locked = submitted !== undefined;
  const chosen = submitted ?? draft;
  const verdict = locked ? gradeExercise(exercise, submitted) : null;
  const toggle = (id: string) => {
    if (locked) return;
    if (!exercise.multiple) return onChange([id]);
    onChange(draft.includes(id) ? draft.filter((x) => x !== id) : [...draft, id]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && canSubmit(exercise, draft)) onSubmit();
      }}
    >
      <fieldset disabled={locked}>
        <legend className="text-sm font-semibold leading-6">{exercise.prompt}</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">{boundsHint(exercise)}</p>
        <div className="mt-3 space-y-2">
          {exercise.options.map((o) => {
            const isChosen = chosen.includes(o.id);
            const reveal = locked && (isChosen || o.verdict === "juste");
            return (
              <div
                key={o.id}
                className={`rounded-md border p-2.5 ${
                  reveal ? VERDICT_STYLES[o.verdict].className : isChosen ? "border-teal bg-teal/5" : "border-border"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6">
                  <input
                    type={exercise.multiple ? "checkbox" : "radio"}
                    name={exercise.id}
                    value={o.id}
                    checked={isChosen}
                    onChange={() => toggle(o.id)}
                    className="mt-1.5 shrink-0 accent-[var(--teal)]"
                  />
                  <span>{o.label}</span>
                </label>
                {reveal ? (
                  <p className="mt-1.5 pl-6 text-xs leading-5 text-foreground">
                    <span className="font-semibold">
                      {OPTION_VERDICT[o.verdict]}
                      {!isChosen ? " (réponse attendue, non choisie)" : ""}.
                    </span>{" "}
                    {o.feedback}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div aria-live="polite">
        {verdict ? (
          <p
            className={`mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-semibold ${VERDICT_STYLES[verdict].className}`}
          >
            {(() => {
              const { Icon } = VERDICT_STYLES[verdict];
              return <Icon size={15} aria-hidden />;
            })()}
            {VERDICT_STYLES[verdict].label}
          </p>
        ) : null}
        {submitted && exercise.requireOneOf && missesRequired(exercise, submitted) ? (
          <p className="mt-2 text-sm text-muted-foreground">{exercise.requireOneOf.hint}</p>
        ) : null}
      </div>
      {!locked ? (
        <button
          type="submit"
          disabled={!canSubmit(exercise, draft)}
          className="mt-3 rounded-md bg-violet px-4 py-2 text-sm font-semibold text-[#04201d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Valider ma réponse
        </button>
      ) : null}
    </form>
  );
}
