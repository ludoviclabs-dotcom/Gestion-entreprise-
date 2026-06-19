import type {
  ComplexiteExplanation,
  QualitePreuveExplanation,
} from "@/lib/risk/engine";
import { EVIDENCE_LABELS, type EvidenceLevel } from "@/lib/graph/graph-types";

/**
 * Décomposition auditable des scores de complexité et de qualité de preuve
 * (P3 — un score doit pouvoir être remonté à ses termes). Ancres `#score-*`
 * pour les pastilles cliquables. Composant serveur, additif.
 */
const LEVELS: EvidenceLevel[] = ["confirmed", "declared", "inferred", "simulated"];

export default function ScoreDetails({
  complexite,
  qualite,
}: {
  complexite: ComplexiteExplanation;
  qualite: QualitePreuveExplanation;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section
        id="score-complexite"
        className="scroll-mt-24 rounded-xl border border-border bg-surface p-5"
      >
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Composition — complexité&nbsp;
          <span className="text-muted-foreground">({complexite.score})</span>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {complexite.entities} entités, {complexite.edges} liens, degré max{" "}
          {complexite.maxDegree}, densité {complexite.density}.
        </p>
        <ul className="mt-3 space-y-1.5">
          {complexite.terms.map((t) => (
            <li
              key={t.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">{t.label}</span>
              <span className="font-medium">+{t.points}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="score-qualite"
        className="scroll-mt-24 rounded-xl border border-border bg-surface p-5"
      >
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Composition — qualité de preuve&nbsp;
          <span className="text-muted-foreground">({qualite.score})</span>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {qualite.solid}/{qualite.total} éléments confirmés ou déclarés (vs
          inférés/simulés).
        </p>
        <ul className="mt-3 space-y-1.5">
          {LEVELS.map((lvl) => (
            <li
              key={lvl}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">{EVIDENCE_LABELS[lvl]}</span>
              <span className="font-medium">{qualite.byLevel[lvl]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
