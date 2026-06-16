import type { MitigatingFactor } from "@/lib/risk/mitigating";

/**
 * Facteurs atténuants — garde-fou faux positifs (P8). Affichés à côté des
 * signaux de vigilance pour rappeler qu'une structure complexe n'est pas
 * suspecte par nature. Composant serveur, additif.
 */
export default function MitigatingFactors({
  factors,
}: {
  factors: MitigatingFactor[];
}) {
  if (factors.length === 0) return null;
  return (
    <section className="rounded-xl border border-emerald/30 bg-emerald/5 p-5">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-emerald">
        Facteurs atténuants
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Éléments rassurants relevés dans ce dossier — une structure complexe
        n&apos;est pas suspecte par nature.
      </p>
      <ul className="mt-4 space-y-2">
        {factors.map((f) => (
          <li key={f.id} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
