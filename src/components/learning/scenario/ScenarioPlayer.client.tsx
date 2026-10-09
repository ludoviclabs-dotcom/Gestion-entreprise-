"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, GitBranch, Lightbulb, Network, NotebookPen, Table2 } from "lucide-react";
import type { LearningPath, Scenario } from "@/lib/learning/schema";
import {
  claimById,
  diffStates,
  evidenceById,
  frDate,
  notebookMarkdown,
  objectLabel,
  resolutionLabel,
  stateAt,
  type Answers,
  type StateDiff,
} from "@/lib/learning/projections";
import { pathReferences } from "@/lib/learning/sources";
import { FictionBanner } from "../FictionBanner";
import { AssetsView } from "./AssetsView";
import { ClaimItem } from "./ClaimItem";
import { Debrief } from "./Debrief";
import { DependenciesView } from "./DependenciesView";
import { EvidenceCard } from "./EvidenceCard";
import { ExercisePanel } from "./ExercisePanel";
import { FlowView } from "./FlowView";
import { Inspector } from "./Inspector";
import { Notebook } from "./Notebook";
import { OwnershipView } from "./OwnershipView";
import { PerspectivesView } from "./PerspectivesView";
import { RelationsTable } from "./RelationsTable";
import { GraphLegend, ScenarioGraph, type Selection } from "./ScenarioGraph";
import { TimelineView } from "./TimelineView";

type Stage =
  | { kind: "step"; index: number }
  | { kind: "choice" }
  | { kind: "branch"; id: string }
  | { kind: "debrief"; id: string };

export type ViewId = "graphe" | "propriete" | "dependances" | "actifs" | "chronologie" | "flux" | "perspectives";

/** Vues disponibles ; chaque parcours choisit les siennes et peut en reformuler la question. */
const VIEW_DEFAULTS: Record<ViewId, { title: string; question: string }> = {
  graphe: { title: "Graphe", question: "Qui est relié à qui, à cette date ?" },
  propriete: { title: "Propriété et gouvernance", question: "Qui contrôle cette entreprise à cette date ?" },
  dependances: { title: "Dépendances", question: "De quel acteur dépend-elle, et dans quel périmètre ?" },
  actifs: { title: "Actifs stratégiques", question: "Qui dispose de quels droits sur chaque actif ?" },
  chronologie: { title: "Chronologie comparée", question: "Qu'est-ce qui a changé depuis le début ?" },
  flux: { title: "Parcours animé", question: "Qu'observe-t-on à chaque étape du paiement ?" },
  perspectives: { title: "Perspectives", question: "Que voit chaque observateur, et que ne voit-il pas ?" },
};

export type ViewConfig = { id: ViewId; title?: string; question?: string };

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const card = "rounded-lg border border-border bg-surface";

const NO_DIFF: StateDiff = { addedEventIds: [], addedRelationIds: [], endedRelationIds: [], newEvidenceIds: [], newClaimIds: [] };

/**
 * Scénario jouable (cadrage §7) : étapes datées, quatre vues coordonnées,
 * inspecteur, carnet, deux branches et débriefing. Tout l'état vit en mémoire ;
 * rien n'est envoyé ni stocké.
 */
export function ScenarioPlayer({
  scenario,
  path,
  views: viewConfig = [{ id: "graphe" }, { id: "propriete" }, { id: "dependances" }, { id: "actifs" }, { id: "chronologie" }],
}: {
  scenario: Scenario;
  path: LearningPath;
  views?: ViewConfig[];
}) {
  const VIEWS = viewConfig.map((v) => ({ ...VIEW_DEFAULTS[v.id], ...v }));
  const last = scenario.steps.length - 1;
  const [stage, setStage] = useState<Stage>({ kind: "step", index: 0 });
  const [reached, setReached] = useState(0);
  const [choiceUnlocked, setChoiceUnlocked] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [drafts, setDrafts] = useState<Answers>({});
  const [lastBranch, setLastBranch] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>(VIEWS[0].id);
  const [table, setTable] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [focusTick, setFocusTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const branchId = stage.kind === "branch" || stage.kind === "debrief" ? stage.id : undefined;
  const stepIndex = stage.kind === "step" ? stage.index : last;
  const state = stateAt(scenario, stepIndex, branchId);
  const prev =
    stage.kind === "step"
      ? stage.index > 0
        ? stateAt(scenario, stage.index - 1)
        : null
      : stage.kind === "branch"
        ? stateAt(scenario, last)
        : state;
  // À la première étape, rien n'est « nouveau » : tout l'est.
  const diff = prev ? diffStates(prev, state) : NO_DIFF;
  const branch = state.branch;
  const plural = (n: number, word: string, adj: string) => `${n} ${word}${n > 1 ? "s" : ""} ${adj}${n > 1 ? "s" : ""}`;
  const changes = [
    diff.addedRelationIds.length ? plural(diff.addedRelationIds.length, "relation", "nouvelle") : "",
    diff.addedEventIds.length ? plural(diff.addedEventIds.length, "opération", "nouvelle") : "",
    diff.endedRelationIds.length ? plural(diff.endedRelationIds.length, "relation", "terminée") : "",
  ].filter(Boolean);

  // Une sélection qui n'existe plus à cette date est ignorée, sans effet de bord.
  const sel: Selection =
    selection &&
    (selection.type === "object"
      ? state.objectIds.includes(selection.id)
      : selection.type === "event"
        ? state.events.some((e) => e.id === selection.id)
        : state.relations.some((r) => r.id === selection.id))
      ? selection
      : null;

  const goTo = (next: Stage) => {
    setStage(next);
    if (next.kind === "step") setReached((r) => Math.max(r, next.index));
    if (next.kind === "choice") setChoiceUnlocked(true);
    if (next.kind === "branch") setLastBranch(next.id);
    setFocusTick((t) => t + 1);
  };

  // Après un changement d'étape, le focus va au titre de l'étape (lecteurs d'écran, mobile).
  useEffect(() => {
    if (focusTick > 0) headingRef.current?.focus();
  }, [focusTick]);

  const restart = () => {
    setAnswers({});
    setDrafts({});
    setReached(0);
    setChoiceUnlocked(false);
    setLastBranch(null);
    setSelection(null);
    setView(VIEWS[0].id);
    goTo({ kind: "step", index: 0 });
  };

  const exportNotebook = () => {
    const today = new Date().toISOString().slice(0, 10);
    download(`carnet-${scenario.id}-${today}.md`, notebookMarkdown(scenario, state, answers, today, pathReferences(path)));
  };

  // Trouver un objet : il s'ouvre dans l'inspecteur et le graphe défile jusqu'à lui. Le focus reste sur la liste.
  const findObject = (id: string) => {
    setSelection(id ? { type: "object", id } : null);
    if (id) document.querySelector(`[data-object="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  };

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const n = (i + delta + VIEWS.length) % VIEWS.length;
    setView(VIEWS[n].id);
    tabRefs.current[n]?.focus();
  };

  const exercise =
    stage.kind === "step" ? scenario.steps[stage.index].exercise : stage.kind === "branch" ? branch?.exercise : undefined;
  const answered = exercise ? answers[exercise.id] : undefined;
  const done = !exercise || answered !== undefined;
  const debriefReachable = scenario.branches.some((b) => b.exercise && answers[b.exercise.id]);
  const otherBranch = branch ? scenario.branches.find((b) => b.id !== branch.id) : undefined;

  const stepper = [
    ...scenario.steps.map((s, i) => ({
      key: s.id,
      label: s.marker,
      current: stage.kind === "step" && stage.index === i,
      enabled: i <= reached,
      go: () => goTo({ kind: "step", index: i }),
    })),
    {
      key: "suite",
      label: "Suite",
      current: stage.kind === "choice" || stage.kind === "branch",
      enabled: choiceUnlocked,
      go: () => goTo(lastBranch ? { kind: "branch", id: lastBranch } : { kind: "choice" }),
    },
    {
      key: "debrief",
      label: "Débriefing",
      current: stage.kind === "debrief",
      enabled: debriefReachable,
      go: () => {
        const id = lastBranch ?? scenario.branches.find((b) => b.exercise && answers[b.exercise.id])?.id;
        if (id) goTo({ kind: "debrief", id });
      },
    },
  ];

  const exercisePanel = exercise ? (
    <ExercisePanel
      key={exercise.id}
      exercise={exercise}
      draft={drafts[exercise.id] ?? []}
      submitted={answered}
      onChange={(ids) => setDrafts((d) => ({ ...d, [exercise.id]: ids }))}
      onSubmit={() => setAnswers((a) => ({ ...a, [exercise.id]: drafts[exercise.id] ?? [] }))}
    />
  ) : null;

  const heading = (title: string, eyebrow: string) => (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-violet">{eyebrow}</p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold outline-none"
      >
        {title}
      </h2>
    </>
  );

  let panel: React.ReactNode;
  if (stage.kind === "step") {
    const step = scenario.steps[stage.index];
    const pieces = step.reveals.map((id) => evidenceById(scenario, id)).filter((e) => e !== undefined);
    const raised = step.raises.map((id) => claimById(scenario, id)).filter((c) => c !== undefined);
    panel = (
      <>
        {heading(step.title, `${step.marker}${step.asOf ? ` · ${frDate(step.asOf)}` : ""}`)}
        <p className="mt-2 text-base leading-7">{step.question}</p>
        {changes.length ? (
          <p className="mt-2 text-xs text-muted-foreground">Dans le graphe : {changes.join(", ")}.</p>
        ) : null}
        {pieces.length ? (
          <section className="mt-4" aria-label="Nouvelles pièces">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouvelles pièces</h3>
            <div className="mt-2 space-y-2">
              {pieces.map((e) => (
                <EvidenceCard key={e.id} scenario={scenario} state={state} evidence={e} />
              ))}
            </div>
          </section>
        ) : null}
        {raised.length ? (
          <section className="mt-4" aria-label="Points soulevés">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Points soulevés</h3>
            <ul className="mt-2 space-y-2">
              {raised.map((c) => (
                <ClaimItem key={c.id} scenario={scenario} claim={c} showVerification={false} />
              ))}
            </ul>
          </section>
        ) : null}
        {exercisePanel ? <div className="mt-5 border-t border-border pt-4">{exercisePanel}</div> : null}
        {done ? (
          <div className="mt-4 rounded-md border border-teal/40 bg-teal/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              <Lightbulb size={13} aria-hidden /> Lecture argumentée
            </p>
            <p className="mt-1.5 text-sm leading-6">{step.explanation}</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {stage.index > 0 ? (
            <button
              type="button"
              onClick={() => goTo({ kind: "step", index: stage.index - 1 })}
              className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={15} aria-hidden /> {scenario.steps[stage.index - 1].marker}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!done}
            onClick={() => goTo(stage.index < last ? { kind: "step", index: stage.index + 1 } : { kind: "choice" })}
            className="inline-flex items-center gap-1 rounded-md bg-violet px-4 py-2 text-sm font-semibold text-[#04201d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {stage.index < last ? `Étape suivante : ${scenario.steps[stage.index + 1].marker}` : "Recevoir les pièces"}
            <ChevronRight size={15} aria-hidden />
          </button>
        </div>
        {!done ? (
          <p className="mt-2 text-right text-xs text-muted-foreground">Validez votre réponse pour continuer.</p>
        ) : null}
      </>
    );
  } else if (stage.kind === "choice") {
    panel = (
      <>
        {heading("Les pièces demandées arrivent", "Suite du dossier")}
        <p className="mt-2 text-sm leading-6">
          Le dossier peut prendre deux tournures selon ce que contiennent les pièces. Choisissez celle à analyser ; vous
          pourrez jouer l'autre ensuite. Aucune n'est « la bonne » : les deux servent à s'entraîner.
        </p>
        <div className="mt-4 grid gap-3">
          {scenario.branches.map((b) => {
            const played = b.exercise && answers[b.exercise.id];
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => goTo({ kind: "branch", id: b.id })}
                className="flex items-start gap-2 rounded-md border border-border p-3 text-left text-sm font-medium hover:border-teal hover:bg-teal/5"
              >
                <GitBranch size={16} className="mt-0.5 shrink-0 text-violet" aria-hidden />
                <span>
                  {b.label}
                  {played ? <span className="block text-xs font-normal text-muted-foreground">Déjà jouée</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (stage.kind === "branch" && branch) {
    const pieces = branch.reveals.map((id) => evidenceById(scenario, id)).filter((e) => e !== undefined);
    panel = (
      <>
        {heading(branch.label, `Suite du dossier${branch.asOf ? ` · ${frDate(branch.asOf)}` : ""}`)}
        <section className="mt-4" aria-label="Nouvelles pièces">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouvelles pièces</h3>
          <div className="mt-2 space-y-2">
            {pieces.map((e) => (
              <EvidenceCard key={e.id} scenario={scenario} state={state} evidence={e} />
            ))}
          </div>
        </section>
        {branch.resolves.length ? (
          <section className="mt-4" aria-label="Ce que les pièces répondent">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ce que les pièces répondent
            </h3>
            <ul className="mt-2 space-y-2 text-sm leading-6">
              {branch.resolves.map((r) => {
                const c = claimById(scenario, r.claimId);
                return c ? (
                  <li key={r.claimId}>
                    <span className="font-medium">{c.statement}</span>{" "}
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{resolutionLabel(r)}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        ) : null}
        {exercisePanel ? <div className="mt-5 border-t border-border pt-4">{exercisePanel}</div> : null}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goTo({ kind: "choice" })}
            className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={15} aria-hidden /> Choix de la suite
          </button>
          <button
            type="button"
            disabled={!done}
            onClick={() => goTo({ kind: "debrief", id: branch.id })}
            className="inline-flex items-center gap-1 rounded-md bg-violet px-4 py-2 text-sm font-semibold text-[#04201d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Voir le débriefing <ChevronRight size={15} aria-hidden />
          </button>
        </div>
      </>
    );
  }

  const currentView = VIEWS.find((v) => v.id === view)!;
  const viewsCard = (
    <section className={`${card} min-w-0`} aria-label="Vues du dossier">
      <div role="tablist" aria-label="Vues" className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-2">
        {VIEWS.map((v, i) => (
          <button
            key={v.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${v.id}`}
            aria-selected={view === v.id}
            aria-controls={`panel-${v.id}`}
            tabIndex={view === v.id ? 0 : -1}
            onClick={() => setView(v.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={`shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
              view === v.id ? "border-teal text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {currentView.question}
            {state.asOf ? <span className="font-normal text-muted-foreground"> État au {frDate(state.asOf)}.</span> : null}
          </p>
          {view === "graphe" ? (
            <div className="flex flex-wrap items-center gap-2">
              {!table ? (
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  Trouver un objet
                  <select
                    value={sel?.type === "object" ? sel.id : ""}
                    onChange={(e) => findObject(e.target.value)}
                    className="max-w-[12rem] rounded-md border border-border bg-surface px-1.5 py-1 text-xs text-foreground"
                  >
                    <option value="">Choisir…</option>
                    {[...state.objectIds]
                      .map((id) => ({ id, label: objectLabel(scenario, id) }))
                      .sort((a, b) => a.label.localeCompare(b.label, "fr"))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => setTable((t) => !t)}
                aria-pressed={table}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
              >
                {table ? <Network size={13} aria-hidden /> : <Table2 size={13} aria-hidden />}
                {table ? "Afficher le graphe" : "Afficher en tableau"}
              </button>
            </div>
          ) : null}
        </div>
        {view === "graphe" ? (
          table ? (
            <RelationsTable scenario={scenario} state={state} diff={diff} selection={sel} onSelect={setSelection} />
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground sm:hidden">
                Faites défiler le graphe horizontalement, ou affichez-le en tableau.
              </p>
              <div className="overflow-x-auto rounded-md border border-border bg-background">
                <ScenarioGraph scenario={scenario} state={state} diff={diff} selection={sel} onSelect={setSelection} />
              </div>
              <div className="mt-3">
                <GraphLegend scenario={scenario} />
              </div>
            </>
          )
        ) : null}
        {view === "propriete" ? <OwnershipView scenario={scenario} state={state} onSelect={setSelection} /> : null}
        {view === "dependances" ? <DependenciesView scenario={scenario} state={state} onSelect={setSelection} /> : null}
        {view === "actifs" ? <AssetsView scenario={scenario} state={state} onSelect={setSelection} /> : null}
        {view === "chronologie" ? <TimelineView scenario={scenario} state={state} /> : null}
        {view === "flux" ? (
          <FlowView
            key={`${stepIndex}-${branchId ?? ""}`}
            scenario={scenario}
            state={state}
            selection={sel}
            onSelect={setSelection}
          />
        ) : null}
        {view === "perspectives" ? <PerspectivesView scenario={scenario} state={state} onSelect={setSelection} /> : null}
      </div>
    </section>
  );

  const inspectorCard = (
    <section className={`${card} p-4`} aria-label="Inspecteur" aria-live="polite">
      <Inspector scenario={scenario} state={state} selection={sel} onSelect={setSelection} />
    </section>
  );

  const notebookCard = (
    <details className={`${card} group`} open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold">
        <NotebookPen size={15} className="text-violet" aria-hidden /> Carnet d'analyse
      </summary>
      <div className="border-t border-border px-4 py-3">
        <Notebook scenario={scenario} state={state} onExport={exportNotebook} />
      </div>
    </details>
  );

  return (
    <>
      <FictionBanner />
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-surface px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <Link
              href={`/lab/${path.slug}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft size={15} aria-hidden /> {path.title}
            </Link>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold sm:text-3xl">
              {scenario.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{scenario.summary}</p>
            <nav aria-label="Étapes du scénario" className="mt-4">
              <ol className="flex flex-wrap gap-1.5">
                {stepper.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      disabled={!s.enabled}
                      aria-current={s.current ? "step" : undefined}
                      onClick={s.go}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        s.current
                          ? "border-teal bg-teal text-[#04201d]"
                          : s.enabled
                            ? "border-border hover:border-teal"
                            : "border-border text-muted-foreground opacity-50"
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </header>

        {stage.kind === "debrief" && branch ? (
          <div className="px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-7xl">
              <section className={`${card} p-5 sm:p-6`}>
                {heading(branch.label, "Débriefing")}
                <div className="mt-5">
                  <Debrief
                    scenario={scenario}
                    branch={branch}
                    answers={answers}
                    otherBranch={otherBranch}
                    onExport={exportNotebook}
                    onPlayBranch={(id) => goTo({ kind: "branch", id })}
                    onRestart={restart}
                  />
                </div>
              </section>
              <h2 className="mt-8 font-[family-name:var(--font-display)] text-lg font-semibold">Revoir le dossier</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-4">
                  {viewsCard}
                  {inspectorCard}
                </div>
                <div className="min-w-0">{notebookCard}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 sm:px-6">
            <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 space-y-4">
                {viewsCard}
                {inspectorCard}
                {/* Sur petit écran, le carnet vient après les vues. */}
                <div className="lg:hidden">{notebookCard}</div>
              </div>
              <div className="order-first min-w-0 space-y-4 lg:order-none">
                <section className={`${card} p-4 sm:p-5`} aria-label="Étape en cours">
                  {panel}
                </section>
                <div className="hidden lg:block">{notebookCard}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
