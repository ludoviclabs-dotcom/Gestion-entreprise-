import { StatusBadge } from "@/components/ui/status-badge";
import { BENFORD_MIN_SAMPLE, type BenfordResult } from "@/lib/risk/transactional";

/**
 * Histogramme de Benford : fréquence observée du premier chiffre (barres) vs
 * attendue (repère pointillé). Pur HTML/CSS, valeurs écrites dans l'infobulle
 * et le tableau accessible. Une déviation n'est pas une preuve — signal à
 * corroborer (faisceau, validation humaine).
 */
const H = 120;

const pct = (v: number) => `${Math.round(v * 100)} %`;

export default function BenfordChart({ result }: { result: BenfordResult }) {
  const max = Math.max(...result.observed, ...result.expected, 0.001);
  const insufficient = result.count < BENFORD_MIN_SAMPLE;
  return (
    <figure>
      <div aria-hidden className="flex items-end gap-1.5" style={{ height: H + 18 }}>
        {result.observed.map((obs, i) => {
          const digit = i + 1;
          const exp = result.expected[i];
          return (
            <div
              key={digit}
              className="flex flex-1 flex-col items-center justify-end"
              title={`Chiffre ${digit} : observé ${pct(obs)}, attendu ${pct(exp)}`}
            >
              <div className="relative flex w-full justify-center" style={{ height: H }}>
                <div
                  className="absolute bottom-0 w-full max-w-6 rounded-t-sm bg-primary/70"
                  style={{ height: Math.max(2, (obs / max) * H) }}
                />
                <div
                  className="absolute w-full max-w-7 border-t-2 border-dashed border-muted-foreground"
                  style={{ bottom: (exp / max) * H }}
                />
              </div>
              <span className="mt-1 text-micro text-subtle tabular-nums">{digit}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 space-y-2 text-xs text-muted-foreground">
        <p>
          <span aria-hidden className="mr-1 inline-block size-2 rounded-sm bg-primary/70 align-middle" />
          observé ·{" "}
          <span aria-hidden className="mx-1 inline-block w-4 border-t-2 border-dashed border-muted-foreground align-middle" />
          attendu (Benford) · χ² = {result.chiSquare.toFixed(1).replace(".", ",")} · n = {result.count}
        </p>
        <p>
          {insufficient ? (
            <StatusBadge tone="neutral">
              Effectif insuffisant (moins de {BENFORD_MIN_SAMPLE} montants) : pas de conclusion
            </StatusBadge>
          ) : result.deviates ? (
            <StatusBadge tone="vigilance">Déviation significative : à corroborer</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Pas de déviation significative</StatusBadge>
          )}
        </p>
      </figcaption>
      <table className="sr-only">
        <caption>Fréquence du premier chiffre des montants, observée et attendue</caption>
        <thead>
          <tr>
            <th scope="col">Chiffre</th>
            <th scope="col">Observé</th>
            <th scope="col">Attendu</th>
          </tr>
        </thead>
        <tbody>
          {result.observed.map((obs, i) => (
            <tr key={i}>
              <th scope="row">{i + 1}</th>
              <td>{pct(obs)}</td>
              <td>{pct(result.expected[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
