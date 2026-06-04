import type { ComputedUbo } from "@/lib/graph/ubo";

/** Tronque à un décimal SANS arrondir au-dessus (24,99 % → 24,9 %, pas 25,0 %). */
function fmtPct(fraction: number): string {
  return `${(Math.floor(fraction * 1000) / 10).toLocaleString("fr-FR")} %`;
}

/**
 * Panneau « Bénéficiaires effectifs » — affiche l'UBO RECALCULÉ depuis le
 * capital (détention effective + contrôle majoritaire, seuil 25 % AMLR).
 * `showNames` (gating CJUE 2022) : nominatif en démo / si UBO exposés, sinon
 * anonymisé. Composant serveur (le calcul est fait par la page).
 */
export default function UboPanel({
  owners,
  showNames,
  ecartExplanation,
}: {
  owners: ComputedUbo[];
  showNames: boolean;
  ecartExplanation?: string;
}) {
  if (owners.length === 0) return null;

  const beneficial = owners.filter((o) => o.isBeneficialOwner);
  const minors = owners.length - beneficial.length;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Bénéficiaires effectifs (recalculés)
        </h3>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          seuil 25 % · AMLR
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Détention effective remontée des chaînes de capital. Le contrôle
        majoritaire (≥ 50 % à chaque étage) vaut bénéficiaire effectif même
        sous 25 %.
      </p>

      <ul className="mt-4 space-y-2">
        {beneficial.map((o, i) => (
          <li
            key={o.personId}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {showNames ? o.label : `Bénéficiaire effectif #${i + 1}`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtPct(o.effectivePct)} de détention effective
                {o.pathsCount > 1 ? ` · ${o.pathsCount} chemins` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                style={{ background: "#10b98122", color: "#10b981" }}
              >
                Bénéficiaire effectif
              </span>
              {o.hasControl ? (
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{ background: "#E69F0022", color: "#E69F00" }}
                >
                  Contrôle
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {minors > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          + {minors} détenteur(s) sous le seuil de 25 %.
        </p>
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
    </section>
  );
}
