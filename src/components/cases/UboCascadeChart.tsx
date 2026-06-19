import type { ComputedUbo } from "@/lib/graph/ubo";
import { UBO_THRESHOLD } from "@/lib/graph/ubo";

/**
 * Cascade de détention effective (computeUbo) — barres horizontales du %
 * effectif par personne, bénéficiaires effectifs (≥ seuil) mis en avant.
 * Compute-first : les % viennent du calcul de cascade, pas d'une inférence.
 * Respecte le gating CJUE (anonymisation si showNames=false). Composant serveur.
 */
export default function UboCascadeChart({
  owners,
  showNames,
}: {
  owners: ComputedUbo[];
  showNames: boolean;
}) {
  const top = [...owners]
    .sort((a, b) => b.effectivePct - a.effectivePct)
    .slice(0, 12);
  if (top.length === 0) return null;
  const threshold = Math.round(UBO_THRESHOLD * 100);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
        Cascade de détention effective
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Détention recalculée depuis le capital (produit des pourcentages le long
        des chaînes). Seuil bénéficiaire effectif : {threshold}&nbsp;%.
      </p>
      <ul className="mt-4 space-y-2.5">
        {top.map((o, i) => {
          const pct = Math.round(o.effectivePct * 100);
          const isUbo = o.isBeneficialOwner;
          return (
            <li key={o.personId}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  {showNames ? o.label : `Bénéficiaire ${i + 1}`}
                  {o.hasControl ? (
                    <span className="ml-1.5 text-[10px] text-violet">contrôle</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{pct}&nbsp;%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-background">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.max(2, Math.min(100, pct))}%`,
                    background: isUbo ? "#7c3aed" : "#94a3b8",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
