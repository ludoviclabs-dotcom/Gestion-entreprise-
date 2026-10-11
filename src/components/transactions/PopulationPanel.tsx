import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { MetricChip } from "@/components/ui/metric-chip";
import {
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  type SignalKind,
  type TriageResult,
} from "@/lib/transactions/triage";
import BenfordChart from "./BenfordChart";

/**
 * Analyses de POPULATION (tout le fichier, indépendamment des filtres) :
 * Benford, IBAN, volume par détecteur. Chaque compteur mène au filtre
 * correspondant de la liste.
 */
export default function PopulationPanel({
  result,
  onFilterSignal,
}: {
  result: TriageResult;
  onFilterSignal: (kind: SignalKind) => void;
}) {
  const counts = Object.fromEntries(
    SIGNAL_KINDS.map((k) => [k, result.items.filter((t) => t.signals.some((s) => s.kind === k)).length]),
  ) as Record<SignalKind, number>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle as="h2">Loi de Benford</PanelTitle>
            <PanelDescription>
              Premier chiffre des {result.report.benford.count} montants du fichier. Une déviation
              oriente l&apos;analyse, elle ne prouve rien.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          <BenfordChart result={result.report.benford} />
        </PanelBody>
      </Panel>

      <div className="space-y-4">
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle as="h2">Détecteurs</PanelTitle>
              <PanelDescription>Transactions concernées par chaque signal.</PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            <ul className="space-y-1">
              {SIGNAL_KINDS.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    disabled={counts[k] === 0}
                    onClick={() => onFilterSignal(k)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-ui hover:border-border hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
                  >
                    <span className="text-foreground">{SIGNAL_LABELS[k]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {counts[k]} transaction{counts[k] > 1 ? "s" : ""}
                      {counts[k] > 0 ? <span className="ml-2 text-primary">Filtrer</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle as="h2">IBAN</PanelTitle>
              <PanelDescription>
                Validation structurelle ISO 13616 — jamais le titulaire du compte.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody className="flex flex-wrap gap-2">
            {result.ibanStats.withIban === 0 ? (
              <p className="text-sm text-muted-foreground">Le fichier ne contient pas de colonne IBAN.</p>
            ) : (
              <>
                <MetricChip label="Renseignés" value={result.ibanStats.withIban} />
                <MetricChip label="Valides" value={`${result.ibanStats.valid}/${result.ibanStats.withIban}`} />
                <MetricChip
                  label="Partagés entre contreparties"
                  value={result.ibanStats.shared}
                  tone={result.ibanStats.shared > 0 ? "vigilance" : undefined}
                />
              </>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
