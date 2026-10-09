import { Download, GitBranch, RotateCcw } from "lucide-react";
import type { EvidenceLevel, Scenario, ScenarioBranch } from "@/lib/learning/schema";
import { answeredExercises, type Answers } from "@/lib/learning/projections";
import { EVIDENCE_LEVEL_LABELS } from "@/lib/learning/labels";
import { VERDICT_STYLES } from "./ExercisePanel";

const LEVELS = (Object.keys(EVIDENCE_LEVEL_LABELS) as EvidenceLevel[]).map((level) => ({
  level,
  ...EVIDENCE_LEVEL_LABELS[level],
}));

/** Débriefing d'une branche : lecture par niveau, questions ouvertes, et réponses comparées aux réponses argumentées. */
export function Debrief({
  scenario,
  branch,
  answers,
  otherBranch,
  onExport,
  onPlayBranch,
  onRestart,
}: {
  scenario: Scenario;
  branch: ScenarioBranch;
  answers: Answers;
  otherBranch?: ScenarioBranch;
  onExport: () => void;
  onPlayBranch: (id: string) => void;
  onRestart: () => void;
}) {
  const answered = answeredExercises(scenario, answers, branch.id);
  const count = (v: "juste" | "partiel" | "faux") => answered.filter((a) => a.verdict === v).length;

  return (
    <div className="space-y-8">
      <section aria-labelledby="debrief-conclusion">
        <h3 id="debrief-conclusion" className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Ce que l'on peut conclure
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-7">{branch.conclusion}</p>
      </section>

      <section aria-labelledby="debrief-niveaux">
        <h3 id="debrief-niveaux" className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Quatre niveaux, à ne pas confondre
        </h3>
        <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {LEVELS.map(({ level, label, hint }, i) => {
            const items = branch.levels.filter((l) => l.level === level);
            return (
              <li key={level} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold text-violet">Niveau {i + 1}</p>
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                <ul className="mt-2 space-y-2 text-sm leading-6">
                  {items.length ? items.map((l) => <li key={l.statement}>{l.statement}</li>) : <li className="text-muted-foreground">Rien à ce niveau.</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="debrief-ouvert" className="rounded-lg border border-border bg-surface p-4">
          <h3 id="debrief-ouvert" className="text-sm font-semibold">Ce qui reste ouvert</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
            {branch.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="debrief-reco" className="rounded-lg border border-border bg-surface p-4">
          <h3 id="debrief-reco" className="text-sm font-semibold">Protections et vérifications recommandées</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
            {branch.recommendations.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="debrief-reponses">
        <h3 id="debrief-reponses" className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Vos réponses
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {count("juste")} juste{count("juste") > 1 ? "s" : ""}, {count("partiel")} partielle{count("partiel") > 1 ? "s" : ""},{" "}
          {count("faux")} à revoir, sur {answered.length} exercices.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 font-medium">Étape</th>
                <th scope="col" className="py-2 pr-3 font-medium">Votre réponse</th>
                <th scope="col" className="py-2 font-medium">Réponse argumentée</th>
              </tr>
            </thead>
            <tbody>
              {answered.map((a) => {
                const style = VERDICT_STYLES[a.verdict];
                return (
                  <tr key={a.exercise.id} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {a.marker}
                      <span className={`mt-1 block w-fit rounded border px-1.5 py-0.5 text-[11px] font-medium ${style.className}`}>
                        {style.label}
                      </span>
                    </th>
                    <td className="py-2 pr-3 leading-6">
                      <ul className="space-y-1">
                        {a.exercise.options
                          .filter((o) => a.selected.includes(o.id))
                          .map((o) => (
                            <li key={o.id}>
                              {o.label}
                              {o.verdict !== "juste" ? (
                                <span className="block text-xs text-muted-foreground">
                                  {o.verdict === "faux" ? "À revoir" : "Partiel"} : {o.feedback}
                                </span>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                    </td>
                    <td className="py-2 leading-6 text-muted-foreground">
                      <ul className="space-y-1">
                        {a.exercise.options
                          .filter((o) => o.verdict === "juste")
                          .map((o) => (
                            <li key={o.id}>{o.label}</li>
                          ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-md bg-violet px-4 py-2 text-sm font-semibold text-[#04201d]"
        >
          <Download size={15} aria-hidden /> Exporter le carnet (.md)
        </button>
        {otherBranch ? (
          <button
            type="button"
            onClick={() => onPlayBranch(otherBranch.id)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            <GitBranch size={15} aria-hidden /> Jouer l'autre suite : {otherBranch.label.replace(/^Branche [A-Z] : /, "")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          <RotateCcw size={15} aria-hidden /> Recommencer le scénario
        </button>
      </div>
    </div>
  );
}
