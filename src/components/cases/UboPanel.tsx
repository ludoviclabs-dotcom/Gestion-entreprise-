import type { UboAnalysis } from "@/lib/graph/ubo";
import { fmtFraction as fmtPct } from "@/lib/graph/ubo";
import type { ProofEvent } from "@/lib/audit/journal";

const QUALIFICATION_STYLE = {
  beneficiaire: { label: "Bénéficiaire effectif", color: "#10b981" },
  a_examiner: { label: "À examiner", color: "#E69F00" },
} as const;

/**
 * Panneau « Bénéficiaires effectifs » — affiche l'UBO RECALCULÉ depuis le
 * capital et les droits de vote, selon le référentiel daté applicable (droit
 * français actuel ou AMLR à partir du 10 juillet 2027), avec les limites du
 * calcul. `showNames` (gating CJUE 2022) : nominatif en démo / si UBO exposés,
 * sinon anonymisé. Composant serveur (le calcul est fait par la page).
 * `ecartHistory` : événements `ecart_ubo_detecte` du journal de preuve —
 * l'historique horodaté soutient le signalement AMLR (divergences sous 14 j).
 */
export default function UboPanel({
  analysis,
  showNames,
  ecartExplanation,
  ecartHistory = [],
}: {
  analysis: UboAnalysis;
  showNames: boolean;
  ecartExplanation?: string;
  ecartHistory?: ProofEvent[];
}) {
  const { owners, policy, limits, asOf } = analysis;
  if (owners.length === 0) return null;

  const listed = owners.filter((o) => o.qualification !== "sous_le_seuil");
  const minors = owners.length - listed.length;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Bénéficiaires effectifs (recalculés)
        </h3>
        <a
          href={policy.url}
          target="_blank"
          rel="noreferrer"
          title={policy.reference}
          className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {policy.thresholdLabel} · {policy.shortLabel}
        </a>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Référentiel appliqué{asOf ? ` au ${asOf.split("-").reverse().join("/")}` : ""} : {policy.label}.
        La détention de capital, les droits de vote et le contrôle sont calculés séparément.
        Un résultat « à examiner » appelle des pièces, pas une conclusion.
      </p>

      <ul className="mt-4 space-y-2">
        {listed.map((o, i) => {
          const style = QUALIFICATION_STYLE[o.qualification as keyof typeof QUALIFICATION_STYLE];
          return (
            <li
              key={o.personId}
              className="rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {showNames ? o.label : `Personne #${i + 1}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Capital {fmtPct(o.effectivePct)}
                    {o.votesAssumed ? "" : ` · votes ${fmtPct(o.effectiveVotingPct)}`}
                    {o.documentedPct < o.effectivePct - 1e-9
                      ? ` · dont documenté ${fmtPct(o.documentedPct)}`
                      : ""}
                    {o.pathsCount > 1 ? ` · ${o.pathsCount} chemins` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{ background: `${style.color}22`, color: style.color }}
                  >
                    {style.label}
                  </span>
                  {o.hasControl ? (
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: "#56B4E922", color: "#56B4E9" }}
                    >
                      Contrôle
                    </span>
                  ) : null}
                </div>
              </div>
              {o.reasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {o.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {minors > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          + {minors} détenteur(s) sous le seuil ({policy.thresholdLabel}).
        </p>
      ) : null}

      {limits.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Limites du calcul
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {limits.map((l) => (
              <li key={`${l.kind}-${l.subjectIds.join(",")}`}>{l.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {ecartExplanation ? (
        <div className="mt-4 rounded-lg border border-[#D55E00]/40 bg-[#D55E00]/10 p-3">
          <p className="text-xs font-semibold text-[#D55E00]">
            Écart registre / capital
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ecartExplanation}
          </p>
        </div>
      ) : null}

      {ecartHistory.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historique des écarts registre / capital
          </p>
          <ul className="mt-1.5 space-y-1">
            {ecartHistory.map((event) => {
              const p = event.payload;
              const counts =
                p.declares !== undefined
                  ? `${String(p.declares)} déclaré(s) · ${String(p.recalcules)} recalculé(s) · ${String(p.divergences)} divergence(s)`
                  : String(p.explication ?? "Écart détecté");
              return (
                <li
                  key={`${event.caseId}-${event.seq}`}
                  className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                >
                  <span>
                    {event.occurredAt.slice(0, 16).replace("T", " ")} UTC —{" "}
                    {counts}
                  </span>
                  <span className="shrink-0 font-mono">
                    {event.entryHash.slice(0, 12)}…
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
