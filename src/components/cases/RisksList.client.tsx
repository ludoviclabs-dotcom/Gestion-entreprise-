"use client";

import { useMemo, useState } from "react";
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  RULE_FAMILY_LABELS,
  EVIDENCE_LABELS,
  familyForRule,
} from "@/lib/graph/graph-types";
import type {
  CaseRiskSignal,
  Severity,
  RiskCategory,
  RuleFamily,
  EvidenceLevel,
} from "@/lib/graph/graph-types";

const CATEGORY_LABELS: Record<RiskCategory, string> = {
  complexite: "Complexité",
  vigilance: "Vigilance",
  qualite_preuve: "Qualité de preuve",
};
const SEVERITIES: Severity[] = ["high", "medium", "low", "info"];
const EVIDENCE_ORDER: EvidenceLevel[] = [
  "confirmed",
  "declared",
  "inferred",
  "simulated",
];

export default function RisksList({ signals }: { signals: CaseRiskSignal[] }) {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [category, setCategory] = useState<RiskCategory | "all">("all");
  const [family, setFamily] = useState<RuleFamily | "all">("all");
  const [evidence, setEvidence] = useState<EvidenceLevel | "all">("all");

  // Familles réellement présentes dans le dossier (facette non vide seulement).
  const families = useMemo(() => {
    const present = new Set(signals.map((s) => familyForRule(s.ruleId)));
    return (Object.keys(RULE_FAMILY_LABELS) as RuleFamily[]).filter((f) =>
      present.has(f),
    );
  }, [signals]);

  // Niveaux de preuve du SUJET réellement présents (facette « Preuve du sujet »).
  const evidenceLevels = useMemo(() => {
    const present = new Set(
      signals.map((s) => s.evidenceLevel).filter(Boolean) as EvidenceLevel[],
    );
    return EVIDENCE_ORDER.filter((l) => present.has(l));
  }, [signals]);

  const filtered = useMemo(
    () =>
      signals.filter(
        (s) =>
          (severity === "all" || s.severity === severity) &&
          (category === "all" || s.category === category) &&
          (family === "all" || familyForRule(s.ruleId) === family) &&
          (evidence === "all" || s.evidenceLevel === evidence),
      ),
    [signals, severity, category, family, evidence],
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition ${
      active
        ? "border-primary bg-primary/15 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Sévérité :</span>
        <button type="button" className={chip(severity === "all")} onClick={() => setSeverity("all")}>
          Toutes
        </button>
        {SEVERITIES.map((s) => (
          <button key={s} type="button" className={chip(severity === s)} onClick={() => setSeverity(s)}>
            {SEVERITY_LABELS[s]}
          </button>
        ))}
        <span className="ml-3 text-xs text-muted-foreground">Catégorie :</span>
        <button type="button" className={chip(category === "all")} onClick={() => setCategory("all")}>
          Toutes
        </button>
        {(Object.keys(CATEGORY_LABELS) as RiskCategory[]).map((c) => (
          <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]}
          </button>
        ))}
        {families.length > 1 ? (
          <>
            <span className="ml-3 text-xs text-muted-foreground">Famille :</span>
            <button type="button" className={chip(family === "all")} onClick={() => setFamily("all")}>
              Toutes
            </button>
            {families.map((f) => (
              <button key={f} type="button" className={chip(family === f)} onClick={() => setFamily(f)}>
                {RULE_FAMILY_LABELS[f]}
              </button>
            ))}
          </>
        ) : null}
        {evidenceLevels.length > 1 ? (
          <>
            <span className="ml-3 text-xs text-muted-foreground">Preuve du sujet :</span>
            <button type="button" className={chip(evidence === "all")} onClick={() => setEvidence("all")}>
              Toutes
            </button>
            {evidenceLevels.map((l) => (
              <button key={l} type="button" className={chip(evidence === l)} onClick={() => setEvidence(l)}>
                {EVIDENCE_LABELS[l]}
              </button>
            ))}
          </>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun signal pour ces filtres.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <span
                className="mt-0.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                style={{
                  background: `${SEVERITY_COLORS[s.severity]}22`,
                  color: SEVERITY_COLORS[s.severity],
                }}
              >
                {SEVERITY_LABELS[s.severity]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{s.explanation}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {RULE_FAMILY_LABELS[familyForRule(s.ruleId)]} ·{" "}
                  {CATEGORY_LABELS[s.category]} · règle {s.ruleId}
                  {s.evidenceLevel
                    ? ` · preuve du sujet : ${EVIDENCE_LABELS[s.evidenceLevel]}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
