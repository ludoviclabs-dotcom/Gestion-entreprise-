import type { BenfordResult } from "@/lib/risk/transactional";

/**
 * Histogramme de Benford : fréquence observée du premier chiffre (barres) vs
 * attendue (repère). Pur SVG/CSS. Une déviation n'est pas une preuve — signal
 * à corroborer (faisceau, validation humaine).
 */
const H = 120;

export default function BenfordChart({ result }: { result: BenfordResult }) {
  const max = Math.max(...result.observed, ...result.expected, 0.001);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: H }}>
        {result.observed.map((obs, i) => {
          const digit = i + 1;
          const exp = result.expected[i];
          return (
            <div
              key={digit}
              className="relative flex flex-1 flex-col items-center justify-end"
              style={{ height: H }}
              title={`Chiffre ${digit} : observé ${Math.round(obs * 100)} %, attendu ${Math.round(exp * 100)} %`}
            >
              <div
                className="w-full max-w-[1.5rem] rounded-t bg-violet/70"
                style={{ height: Math.max(2, (obs / max) * H) }}
              />
              {/* repère attendu (Benford) */}
              <div
                className="absolute left-0 right-0 mx-auto w-full max-w-[1.75rem] border-t-2 border-dashed border-amber"
                style={{ bottom: (exp / max) * H }}
              />
              <span className="mt-1 text-[10px] text-muted-foreground">{digit}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="inline-block size-2 rounded-sm bg-violet/70 align-middle" />{" "}
        observé · <span className="align-middle text-amber">– –</span> attendu
        (Benford). χ² = {result.chiSquare.toFixed(1)} (n = {result.count}) —{" "}
        {result.deviates ? (
          <span className="text-amber">déviation significative (à corroborer)</span>
        ) : (
          "pas de déviation significative"
        )}
        .
      </p>
    </div>
  );
}
