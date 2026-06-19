import type { StructuralIndicators } from "@/lib/risk/indicators";

/**
 * Indicateurs structurels (compute-first) dérivés du graphe — opacité
 * capitalistique, exposition transfrontalière, concentration de domiciliation.
 * Composant serveur, additif. Chiffres à verser au faisceau, jamais un verdict.
 */
export default function IndicatorsPanel({
  indicators,
}: {
  indicators: StructuralIndicators;
}) {
  const { opacity, crossBorder, domiciliation } = indicators;
  const rows: { label: string; value: string; hint: string }[] = [];

  if (opacity.total > 0) {
    rows.push({
      label: "Opacité capitalistique",
      value: `${Math.round(opacity.ratio * 100)} %`,
      hint: `${opacity.missing}/${opacity.total} lien(s) de détention sans pourcentage exploitable.`,
    });
  }
  if (crossBorder.hasForeign) {
    rows.push({
      label: "Exposition transfrontalière",
      value: `${crossBorder.count} pays`,
      hint: `Sociétés mères à l'étranger : ${crossBorder.countries.join(", ")}${
        crossBorder.hasNonEu ? " — dont hors UE/EEE" : ""
      }.`,
    });
  }
  if (domiciliation.maxDegree >= 2) {
    rows.push({
      label: "Concentration de domiciliation",
      value: `${domiciliation.maxDegree} sociétés`,
      hint: `À la même adresse${
        domiciliation.addressLabel ? ` : ${domiciliation.addressLabel}` : ""
      }.`,
    });
  }

  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
        Indicateurs structurels
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Chiffres dérivés du graphe — à verser au faisceau, jamais une conclusion.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-lg border border-border bg-background p-3"
          >
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{r.value}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{r.hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
