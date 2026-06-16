import type { CaseSummary } from "@/lib/data/types";
import {
  RULE_FAMILY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
} from "@/lib/graph/graph-types";
import type { RuleFamily, Severity } from "@/lib/graph/graph-types";

const SEVS: Severity[] = ["high", "medium", "low", "info"];

/**
 * Matrice de chaleur PORTEFEUILLE (V9) : famille structurelle × sévérité, sommée
 * sur les dossiers. Axe « famille » non accusatoire (jamais une infraction) ;
 * cellule = volume de signaux à instruire. Composant serveur, additif.
 *
 * Surface de la répartition `signalsByFamilySeverity` : présente via `listCases`
 * en mode démo/fixtures, ABSENTE de l'agrégat SQL `listCases` en mode base (par
 * conception). En mode base, le composant se masque (retourne null) jusqu'à ce
 * que cet agrégat porte la ventilation — voir types.ts.
 */
export default function PortfolioHeatmap({ cases }: { cases: CaseSummary[] }) {
  const withBreakdown = cases.filter((c) => c.signalsByFamilySeverity);
  if (withBreakdown.length === 0) return null;

  const agg = new Map<RuleFamily, Record<Severity, number>>();
  for (const c of withBreakdown) {
    const m = c.signalsByFamilySeverity;
    if (!m) continue;
    for (const fam of Object.keys(m) as RuleFamily[]) {
      const row = agg.get(fam) ?? { high: 0, medium: 0, low: 0, info: 0 };
      const sevs = m[fam] ?? {};
      for (const sev of SEVS) row[sev] += sevs[sev] ?? 0;
      agg.set(fam, row);
    }
  }
  const families = (Object.keys(RULE_FAMILY_LABELS) as RuleFamily[]).filter((f) =>
    agg.has(f),
  );
  if (families.length === 0) return null;

  const allCounts = families.flatMap((f) => {
    const r = agg.get(f);
    return r ? SEVS.map((s) => r[s]) : [];
  });
  const max = Math.max(1, ...allCounts);
  const alpha = (n: number) => {
    if (n === 0) return "00";
    const a = 0.14 + 0.58 * (n / max);
    return Math.round(a * 255)
      .toString(16)
      .padStart(2, "0");
  };

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold">
        Répartition des signaux — famille × sévérité
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Vue portefeuille sur {withBreakdown.length} dossier(s). Volume de signaux
        à instruire, jamais une qualification.
      </p>
      <div className="mt-4 overflow-x-auto">
        <div
          className="grid min-w-[480px] gap-1 text-xs"
          style={{
            gridTemplateColumns: `minmax(150px,1.4fr) repeat(${SEVS.length}, 1fr)`,
          }}
        >
          <div className="px-2 py-1 font-semibold uppercase tracking-wide text-muted-foreground">
            Famille
          </div>
          {SEVS.map((s) => (
            <div
              key={s}
              className="px-2 py-1 text-center font-semibold uppercase tracking-wide"
              style={{ color: SEVERITY_COLORS[s] }}
            >
              {SEVERITY_LABELS[s]}
            </div>
          ))}
          {families.map((f) => {
            const row = agg.get(f);
            if (!row) return null;
            return (
              <div key={f} style={{ display: "contents" }}>
                <div className="flex items-center px-2 py-2 text-foreground">
                  {RULE_FAMILY_LABELS[f]}
                </div>
                {SEVS.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-center rounded-md py-2 tabular-nums"
                    style={{
                      background: `${SEVERITY_COLORS[s]}${alpha(row[s])}`,
                      color:
                        row[s] > 0 ? SEVERITY_COLORS[s] : "var(--muted-foreground)",
                    }}
                  >
                    {row[s]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
