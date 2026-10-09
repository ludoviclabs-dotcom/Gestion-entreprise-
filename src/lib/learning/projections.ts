import type {
  Actor,
  Claim,
  Evidence,
  Exercise,
  Relation,
  RelationKind,
  Resource,
  Scenario,
  ScenarioBranch,
  ScenarioStep,
  Verdict,
} from "./schema";
import {
  UBO_POLICIES,
  classifyDirectHolders,
  meetsThreshold,
  uboPolicyFor,
  type UboControl,
  type UboPolicy,
} from "@/lib/graph/ubo";

/**
 * Projections pures d'un scénario (cadrage §8) : chaque vue (graphe, capital,
 * actifs, dépendances, chronologie, carnet) lit le même état, calculé à partir
 * de la position de l'apprenant. Rien n'est stocké en double.
 *
 * Deux filtres s'appliquent à une relation :
 *   - temporel : elle est valide à la date de l'étape (`asOf`) ;
 *   - de connaissance : au moins une de ses affirmations est connue, c'est-à-dire
 *     appuyée par une pièce déjà révélée ou soulevée par une étape déjà jouée.
 */

// ── État à une position ───────────────────────────────────────────────────

export type Resolution = {
  outcome: "renseignee" | "confirmee" | "infirmee";
  byClaimId: string;
};

export type ScenarioState = {
  stepIndex: number;
  step: ScenarioStep;
  branch?: ScenarioBranch;
  /** Date de l'état affiché, ou undefined si aucune étape jouée n'en fixe une. */
  asOf?: string;
  evidenceIds: Set<string>;
  claimIds: Set<string>;
  /** Relations visibles, dans l'ordre du scénario. */
  relations: Relation[];
  /** Objets visibles (sujet + extrémités des relations visibles). */
  objectIds: string[];
  resolutions: Map<string, Resolution>;
};

function isValidAt(r: Pick<Relation, "validFrom" | "validTo">, asOf?: string): boolean {
  if (!asOf) return true;
  if (r.validFrom && r.validFrom > asOf) return false;
  if (r.validTo && r.validTo < asOf) return false;
  return true;
}

/**
 * État du scénario après les étapes 0..stepIndex, et la branche si elle est
 * choisie. Une branche se joue après la dernière étape.
 */
export function stateAt(scenario: Scenario, stepIndex: number, branchId?: string): ScenarioState {
  const index = Math.max(0, Math.min(stepIndex, scenario.steps.length - 1));
  const steps = scenario.steps.slice(0, index + 1);
  const branch = branchId ? scenario.branches.find((b) => b.id === branchId) : undefined;

  let asOf: string | undefined;
  for (const s of steps) if (s.asOf) asOf = s.asOf;
  if (branch?.asOf) asOf = branch.asOf;

  const evidenceIds = new Set<string>([...steps.flatMap((s) => s.reveals), ...(branch?.reveals ?? [])]);
  const raised = new Set(steps.flatMap((s) => s.raises));
  const claimIds = new Set(
    scenario.claims
      .filter((c) => raised.has(c.id) || c.evidenceIds.some((e) => evidenceIds.has(e)))
      .map((c) => c.id),
  );

  const relations = scenario.relations.filter(
    (r) =>
      (!r.branchId || r.branchId === branch?.id) &&
      isValidAt(r, asOf) &&
      (r.claimIds.length === 0 || r.claimIds.some((c) => claimIds.has(c))),
  );

  const visible = new Set<string>([scenario.subjectId]);
  for (const r of relations) {
    visible.add(r.source);
    visible.add(r.target);
  }
  const order = [...scenario.actors.map((a) => a.id), ...scenario.resources.map((r) => r.id)];
  const objectIds = order.filter((id) => visible.has(id));

  const resolutions = new Map<string, Resolution>();
  for (const r of branch?.resolves ?? []) resolutions.set(r.claimId, { outcome: r.outcome, byClaimId: r.byClaimId });

  return { stepIndex: index, step: scenario.steps[index], branch, asOf, evidenceIds, claimIds, relations, objectIds, resolutions };
}

export type StateDiff = {
  addedRelationIds: string[];
  endedRelationIds: string[];
  newEvidenceIds: string[];
  newClaimIds: string[];
};

/** Ce qui apparaît et disparaît entre deux états (surbrillance « nouveau »). */
export function diffStates(prev: ScenarioState | null, next: ScenarioState): StateDiff {
  const prevRel = new Set(prev?.relations.map((r) => r.id) ?? []);
  const nextRel = new Set(next.relations.map((r) => r.id));
  return {
    addedRelationIds: [...nextRel].filter((id) => !prevRel.has(id)),
    endedRelationIds: [...prevRel].filter((id) => !nextRel.has(id)),
    newEvidenceIds: [...next.evidenceIds].filter((id) => !prev?.evidenceIds.has(id)),
    newClaimIds: [...next.claimIds].filter((id) => !prev?.claimIds.has(id)),
  };
}

// ── Accès aux objets ──────────────────────────────────────────────────────

export type ScenarioObject = { type: "actor"; actor: Actor } | { type: "resource"; resource: Resource };

export function objectById(scenario: Scenario, id: string): ScenarioObject | undefined {
  const actor = scenario.actors.find((a) => a.id === id);
  if (actor) return { type: "actor", actor };
  const resource = scenario.resources.find((r) => r.id === id);
  if (resource) return { type: "resource", resource };
  return undefined;
}

export function objectLabel(scenario: Scenario, id: string): string {
  const o = objectById(scenario, id);
  if (!o) return id;
  return o.type === "actor" ? o.actor.name : o.resource.label;
}

export function claimById(scenario: Scenario, id: string): Claim | undefined {
  return scenario.claims.find((c) => c.id === id);
}

export function evidenceById(scenario: Scenario, id: string): Evidence | undefined {
  return scenario.evidence.find((e) => e.id === id);
}

/** Affirmations connues qui portent sur un objet. */
export function knownClaimsAbout(scenario: Scenario, state: ScenarioState, objectId: string): Claim[] {
  return scenario.claims.filter((c) => state.claimIds.has(c.id) && c.about.includes(objectId));
}

/** Affirmations connues d'une relation. */
export function knownClaimsOf(scenario: Scenario, state: ScenarioState, relation: Relation): Claim[] {
  return relation.claimIds
    .filter((id) => state.claimIds.has(id))
    .map((id) => claimById(scenario, id))
    .filter((c): c is Claim => c !== undefined);
}

// ── Formats ───────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nfAmount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** « 38,5 % » à partir d'une chaîne décimale « 38.5 ». */
export function frPct(pct: string | number): string {
  return `${nf.format(Number(pct))} %`;
}

/** « 3 600 000 € » ; une unité inconnue est affichée telle quelle. */
export function frAmount(value: string, unit: string): string {
  const n = nfAmount.format(Number(value));
  return unit === "EUR" ? `${n} €` : `${n} ${unit}`;
}

/** « 15/01/2025 ». */
export function frDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  titularite: "Titularité",
  detention: "Détention",
  controle: "Droits de contrôle",
  direction: "Direction",
  licence: "Licence",
  acces: "Accès",
  dependance: "Dépendance",
  financement: "Financement",
  surete: "Sûreté",
  prestation: "Prestation",
  titulaire_compte: "Titulaire du compte",
};

/** Libellé court d'une relation dans le graphe et les tableaux. */
export function relationShortLabel(r: Relation): string {
  if (r.kind === "detention" && r.capitalPct) {
    if (r.votingPct && r.votingPct !== r.capitalPct) return `${frPct(r.capitalPct)} capital, ${frPct(r.votingPct)} votes`;
    return frPct(r.capitalPct);
  }
  return r.label ?? RELATION_KIND_LABELS[r.kind];
}

export function validityLabel(r: Pick<Relation, "validFrom" | "validTo">): string {
  if (r.validFrom && r.validTo) return `du ${frDate(r.validFrom)} au ${frDate(r.validTo)}`;
  if (r.validFrom) return `depuis le ${frDate(r.validFrom)}`;
  if (r.validTo) return `jusqu'au ${frDate(r.validTo)}`;
  return "dates non précisées";
}

// ── Propriété et gouvernance ──────────────────────────────────────────────

export type HolderQualification = "beneficiaire" | "a_examiner" | "sous_le_seuil" | "personne_morale";

export type Holder = {
  actor: Actor;
  relationId: string;
  capitalPct: string;
  votingPct: string;
  control: UboControl;
  qualification: HolderQualification;
  /** Informations manquantes connues sur ce détenteur. */
  missing: Claim[];
};

export type Ownership = {
  asOf?: string;
  policy: UboPolicy;
  /** Référentiel suivant, s'il s'applique plus tard (AMLR). */
  upcoming?: UboPolicy;
  holders: Holder[];
  totalCapitalPct: number;
  totalVotingPct: number;
  otherControl: { actor: Actor; relation: Relation }[];
  directors: { actor: Actor; relation: Relation }[];
};

/**
 * Propriété directe du sujet à l'état donné. Les pourcentages viennent des
 * pièces ; le contrôle est classé par la même règle que le moteur UBO
 * (majorité stricte ou présomption de l'art. L. 233-3 II).
 */
export function ownershipAt(scenario: Scenario, state: ScenarioState): Ownership {
  const asOf = state.asOf;
  const policy = asOf ? uboPolicyFor(asOf) : UBO_POLICIES.FR_CMF_R561_1;
  const upcoming =
    policy.appliesUntil && policy.id === "FR_CMF_R561_1" ? UBO_POLICIES.EU_AMLR_2024_1624 : undefined;

  const into = (kind: RelationKind) => state.relations.filter((r) => r.kind === kind && r.target === scenario.subjectId);
  const actorOf = (id: string) => scenario.actors.find((a) => a.id === id);

  const raw = into("detention")
    .map((r) => {
      const actor = actorOf(r.source);
      if (!actor || !r.capitalPct) return null;
      const votingPct = r.votingPct ?? r.capitalPct;
      return { actor, relationId: r.id, capitalPct: r.capitalPct, votingPct, votes: Number(votingPct) / 100 };
    })
    .filter((h) => h !== null);

  const holders: Holder[] = classifyDirectHolders(raw).map((h) => {
    const capital = Number(h.capitalPct) / 100;
    let qualification: HolderQualification;
    if (h.actor.kind !== "personne") qualification = "personne_morale";
    else if (meetsThreshold(capital, policy) || meetsThreshold(h.votes, policy) || h.control === "majorite")
      qualification = "beneficiaire";
    else if (h.control === "presomption") qualification = "a_examiner";
    else qualification = "sous_le_seuil";
    const missing = knownClaimsAbout(scenario, state, h.actor.id).filter((c) => c.nature === "information_manquante");
    return {
      actor: h.actor,
      relationId: h.relationId,
      capitalPct: h.capitalPct,
      votingPct: h.votingPct,
      control: h.control,
      qualification,
      missing,
    };
  });
  holders.sort((a, b) => Number(b.votingPct) - Number(a.votingPct));

  const sum = (xs: string[]) => Math.round(xs.reduce((t, x) => t + Number(x), 0) * 100) / 100;
  const withActor = (rs: Relation[]) =>
    rs.map((relation) => ({ actor: actorOf(relation.source), relation })).filter((x): x is { actor: Actor; relation: Relation } => !!x.actor);

  return {
    asOf,
    policy,
    upcoming,
    holders,
    totalCapitalPct: sum(holders.map((h) => h.capitalPct)),
    totalVotingPct: sum(holders.map((h) => h.votingPct)),
    otherControl: withActor(into("controle")),
    directors: withActor(into("direction")),
  };
}

export type OwnershipColumn = { marker: string; asOf: string; holders: Holder[] };

/**
 * Chronologie comparée : l'actionnariat à chaque étape datée jouée jusqu'ici.
 * Chaque colonne n'utilise que ce qui était connu à cette étape.
 */
export function ownershipHistory(scenario: Scenario, upToStep: number): OwnershipColumn[] {
  const columns: OwnershipColumn[] = [];
  scenario.steps.slice(0, upToStep + 1).forEach((step, i) => {
    if (!step.asOf) return;
    const own = ownershipAt(scenario, stateAt(scenario, i));
    columns.push({ marker: step.marker, asOf: step.asOf, holders: own.holders });
  });
  return columns;
}

// ── Dépendances ───────────────────────────────────────────────────────────

export type DependencyGroup = "commerciale" | "financiere" | "technique";

export type Dependency = {
  relation: Relation;
  group: DependencyGroup;
  counterpartId: string;
  ratio?: { numerator: string; denominator: string; pct: number; period: string; scope: string };
};

const DEPENDENCY_GROUP: Partial<Record<RelationKind, DependencyGroup>> = {
  dependance: "commerciale",
  licence: "commerciale",
  financement: "financiere",
  surete: "financiere",
  prestation: "technique",
  acces: "technique",
};

export const DEPENDENCY_GROUP_LABELS: Record<DependencyGroup, string> = {
  commerciale: "Commerciale",
  financiere: "Financière",
  technique: "Technique et accès",
};

/** Dépendances visibles : un ratio est toujours affiché avec ses entrées et son périmètre. */
export function dependenciesAt(scenario: Scenario, state: ScenarioState): Dependency[] {
  const subjectOwned = new Set(
    state.relations.filter((r) => r.kind === "titularite" && r.source === scenario.subjectId).map((r) => r.target),
  );
  const near = (id: string) => id === scenario.subjectId || subjectOwned.has(id);
  return state.relations
    .filter((r) => DEPENDENCY_GROUP[r.kind] && (near(r.source) || near(r.target)))
    .map((relation) => {
      const counterpartId = near(relation.source) ? relation.target : relation.source;
      const m = relation.measure;
      const ratio = m
        ? {
            numerator: frAmount(m.numerator.value, m.numerator.unit),
            denominator: frAmount(m.denominator.value, m.denominator.unit),
            pct: (Number(m.numerator.value) / Number(m.denominator.value)) * 100,
            period: m.period,
            scope: m.scope,
          }
        : undefined;
      return { relation, group: DEPENDENCY_GROUP[relation.kind]!, counterpartId, ratio };
    });
}

// ── Actifs ────────────────────────────────────────────────────────────────

export type AssetRights = {
  resource: Resource;
  holderIds: string[];
  licences: Relation[];
  suretes: Relation[];
  acces: Relation[];
  claims: Claim[];
};

/** Pour chaque actif visible : titulaire, licences, sûretés et accès, séparément. */
export function assetsAt(scenario: Scenario, state: ScenarioState): AssetRights[] {
  return scenario.resources
    .filter((res) => state.objectIds.includes(res.id))
    .map((resource) => {
      const touching = state.relations.filter((r) => r.source === resource.id || r.target === resource.id);
      return {
        resource,
        holderIds: touching.filter((r) => r.kind === "titularite").map((r) => r.source),
        licences: touching.filter((r) => r.kind === "licence"),
        suretes: touching.filter((r) => r.kind === "surete"),
        acces: touching.filter((r) => r.kind === "acces"),
        claims: knownClaimsAbout(scenario, state, resource.id),
      };
    });
}

// ── Chronologie des pièces ────────────────────────────────────────────────

export type TimelineEntry =
  | { type: "evidence"; date: string; evidence: Evidence }
  | { type: "marker"; date: string; marker: string; title: string };

/** Pièces révélées et repères d'étape, triés par date (les repères après les pièces du même jour). */
export function timelineAt(scenario: Scenario, state: ScenarioState): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const id of state.evidenceIds) {
    const e = evidenceById(scenario, id);
    if (e?.date) entries.push({ type: "evidence", date: e.date, evidence: e });
  }
  scenario.steps.slice(0, state.stepIndex + 1).forEach((s) => {
    if (s.asOf) entries.push({ type: "marker", date: s.asOf, marker: s.marker, title: s.title });
  });
  return entries.sort((a, b) => a.date.localeCompare(b.date) || (a.type === b.type ? 0 : a.type === "evidence" ? -1 : 1));
}

// ── Exercices ─────────────────────────────────────────────────────────────

/** Nombre de choix attendus : [min, max]. */
export function selectionBounds(exercise: Exercise): [number, number] {
  if (!exercise.multiple) return [1, 1];
  return [exercise.minSelected ?? 1, exercise.maxSelected ?? exercise.options.length];
}

export function canSubmit(exercise: Exercise, selected: string[]): boolean {
  const [min, max] = selectionBounds(exercise);
  return selected.length >= min && selected.length <= max;
}

/**
 * Verdict global d'une réponse. Une réponse multiple contenant une accusation
 * sans pièce n'est jamais « juste », même si les autres choix le sont.
 */
export function gradeExercise(exercise: Exercise, selected: string[]): Verdict {
  const verdicts = exercise.options.filter((o) => selected.includes(o.id)).map((o) => o.verdict);
  if (verdicts.length === 0) return "faux";
  if (verdicts.every((v) => v === "juste")) return "juste";
  if (verdicts.every((v) => v === "faux")) return "faux";
  return "partiel";
}

export type Answers = Record<string, string[]>;

export type AnsweredExercise = {
  marker: string;
  exercise: Exercise;
  selected: string[];
  verdict: Verdict;
};

/** Exercices répondus, dans l'ordre du scénario (étapes puis branche). */
export function answeredExercises(scenario: Scenario, answers: Answers, branchId?: string): AnsweredExercise[] {
  const branch = scenario.branches.find((b) => b.id === branchId);
  const items: { marker: string; exercise?: Exercise }[] = [
    ...scenario.steps.map((s) => ({ marker: s.marker, exercise: s.exercise })),
    ...(branch ? [{ marker: branch.label, exercise: branch.exercise }] : []),
  ];
  return items
    .filter((i): i is { marker: string; exercise: Exercise } => !!i.exercise && !!answers[i.exercise.id])
    .map(({ marker, exercise }) => ({
      marker,
      exercise,
      selected: answers[exercise.id],
      verdict: gradeExercise(exercise, answers[exercise.id]),
    }));
}

// ── Export du carnet ──────────────────────────────────────────────────────

const NATURE_TITLES: Record<Claim["nature"], string> = {
  fait_documente: "Faits documentés",
  allegation: "Allégations",
  hypothese: "Hypothèses",
  information_manquante: "Informations manquantes",
};

const OUTCOME_LABELS: Record<Resolution["outcome"], string> = {
  renseignee: "renseignée",
  confirmee: "confirmée",
  infirmee: "infirmée",
};

const VERDICT_LABELS: Record<Verdict, string> = { juste: "juste", partiel: "partielle", faux: "à revoir" };

export function resolutionLabel(r: Resolution): string {
  return OUTCOME_LABELS[r.outcome];
}

export function verdictLabel(v: Verdict): string {
  return VERDICT_LABELS[v];
}

/**
 * Carnet d'analyse en Markdown. Il porte toujours la mention « cas fictif » et
 * la date de l'état, pour qu'aucun extrait ne circule comme un dossier réel.
 */
export function notebookMarkdown(
  scenario: Scenario,
  state: ScenarioState,
  answers: Answers,
  generatedOn: string,
): string {
  const lines: string[] = [
    `# Carnet d'analyse : ${scenario.title}`,
    "",
    "> **Cas fictif, formation.** Noms, pièces et montants sont inventés ; rien ici ne qualifie une personne ou une entreprise réelle.",
    "",
    `- Scénario : ${scenario.title} (version ${scenario.version})`,
    `- Étape : ${state.branch ? state.branch.label : `${state.step.marker}, ${state.step.title}`}`,
    state.asOf ? `- État au : ${frDate(state.asOf)}` : "",
    `- Exporté le : ${frDate(generatedOn)}`,
    "",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "");

  for (const nature of Object.keys(NATURE_TITLES) as Claim["nature"][]) {
    const claims = scenario.claims.filter((c) => c.nature === nature && state.claimIds.has(c.id));
    if (claims.length === 0) continue;
    lines.push(`## ${NATURE_TITLES[nature]}`, "");
    for (const c of claims) {
      const pieces = c.evidenceIds
        .filter((e) => state.evidenceIds.has(e))
        .map((e) => evidenceById(scenario, e)?.title)
        .filter(Boolean);
      const res = state.resolutions.get(c.id);
      const resText = res ? ` — ${resolutionLabel(res)} : ${claimById(scenario, res.byClaimId)?.statement ?? ""}` : "";
      lines.push(`- ${c.statement}${pieces.length ? ` (pièces : ${pieces.join(" ; ")})` : ""}${resText}`);
    }
    lines.push("");
  }

  const answered = answeredExercises(scenario, answers, state.branch?.id);
  if (answered.length) {
    lines.push("## Réponses", "");
    for (const a of answered) {
      const labels = a.exercise.options.filter((o) => a.selected.includes(o.id)).map((o) => o.label);
      lines.push(`- **${a.marker}** (${verdictLabel(a.verdict)}) : ${labels.join(" ; ")}`);
    }
    lines.push("");
  }

  if (state.branch) {
    lines.push("## Conclusion", "", state.branch.conclusion, "");
    if (state.branch.openQuestions.length) {
      lines.push("### Ce qui reste ouvert", "", ...state.branch.openQuestions.map((q) => `- ${q}`), "");
    }
  }

  lines.push("---", "", "Export du Lab KYB Graph. Cas fictif, à usage de formation uniquement.", "");
  return lines.join("\n");
}
