import {
  INVESTIGATION_FICHES,
  type InvestigationFiche as Fiche,
} from "@/lib/domain/investigation-fiches";
import { REG } from "@/lib/domain/regulatory-refs";

/**
 * Fiche d'investigation repliable par règle/typologie (M11) : pièces à vérifier
 * + incohérences à lever (questions) + ancrages réglementaires. Additif (balise
 * <details>, calqué sur AlgorithmExplainer). Composant serveur. Dégrade en null
 * si aucune fiche n'existe pour ce `ruleId`.
 */
export function InvestigationFiche({
  ruleId,
  label,
}: {
  ruleId: string;
  label?: string;
}) {
  const fiche = (INVESTIGATION_FICHES as Record<string, Fiche>)[ruleId];
  if (!fiche) return null;
  return (
    <details className="rounded-lg border border-border bg-background p-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-foreground">
        Fiche d&apos;investigation — {label ?? ruleId}
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pièces à vérifier
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {fiche.documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Incohérences à lever
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {fiche.incoherences.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {fiche.refs.map((k) => (
            <a
              key={k}
              href={REG[k].url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground underline decoration-dotted underline-offset-2 transition hover:text-foreground"
            >
              {REG[k].label}
            </a>
          ))}
        </div>
      </div>
    </details>
  );
}
